/**
 * Client-side encryption service using Web Crypto API
 * Implements AES-GCM-256 encryption for clipboard content
 */

export class EncryptionService {
    private static ALGORITHM = 'AES-GCM';
    private static KEY_LENGTH = 256;
    private static IV_LENGTH = 12; // 96 bits for GCM

    /**
     * Generate a new encryption key and store in localStorage
     */
    static async generateKey(): Promise<CryptoKey> {
        const key = await crypto.subtle.generateKey(
            {
                name: this.ALGORITHM,
                length: this.KEY_LENGTH,
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );

        // Export and store key
        const exported = await crypto.subtle.exportKey('jwk', key);
        localStorage.setItem('encryption_key', JSON.stringify(exported));

        return key;
    }

    /**
     * Get or create encryption key from localStorage
     */
    static async getKey(): Promise<CryptoKey> {
        const storedKey = localStorage.getItem('encryption_key');

        if (storedKey) {
            const jwk = JSON.parse(storedKey);
            return await crypto.subtle.importKey(
                'jwk',
                jwk,
                {
                    name: this.ALGORITHM,
                    length: this.KEY_LENGTH,
                },
                true,
                ['encrypt', 'decrypt']
            );
        }

        // Generate new key if not found
        return await this.generateKey();
    }

    /**
     * Generate random Initialization Vector
     */
    private static generateIV(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    }

    /**
     * Encrypt plaintext content
     * 
     * @param plaintext - Content to encrypt
     * @returns Object with encrypted content and IV (both base64 encoded)
     */
    static async encrypt(plaintext: string): Promise<{
        encrypted: string;
        iv: string;
    }> {
        const key = await this.getKey();
        const iv = this.generateIV();

        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);

        const encryptedData = await crypto.subtle.encrypt(
            {
                name: this.ALGORITHM,
                iv: iv as any,
            },
            key,
            data
        );

        // Convert to base64 for transmission
        const encryptedBase64 = this.arrayBufferToBase64(encryptedData);
        const ivBase64 = this.arrayBufferToBase64(iv.buffer as ArrayBuffer);

        return {
            encrypted: encryptedBase64,
            iv: ivBase64,
        };
    }

    /**
     * Decrypt encrypted content
     * 
     * @param encrypted - Base64 encoded encrypted content
     * @param iv - Base64 encoded initialization vector
     * @returns Decrypted plaintext
     */
    static async decrypt(encrypted: string, iv: string): Promise<string> {
        const key = await this.getKey();

        const encryptedData = this.base64ToArrayBuffer(encrypted);
        const ivData = this.base64ToArrayBuffer(iv);

        const decryptedData = await crypto.subtle.decrypt(
            {
                name: this.ALGORITHM,
                iv: ivData,
            },
            key,
            encryptedData
        );

        const decoder = new TextDecoder();
        return decoder.decode(decryptedData);
    }

    /**
     * Generate SHA-256 hash of content for deduplication
     */
    static async hash(content: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);

        // Convert to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Convert ArrayBuffer to Base64 string
     */
    private static arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Base64 string to ArrayBuffer
     */
    private static base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Clear encryption key (for logout)
     */
    static clearKey(): void {
        localStorage.removeItem('encryption_key');
    }
}
