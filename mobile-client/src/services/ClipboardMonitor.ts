/**
 * Mobile Clipboard Service
 * Monitors clipboard changes and syncs with backend
 */
import Clipboard from '@react-native-clipboard/clipboard';
import { EncryptionService } from './EncryptionService';
import { clipboardAPI } from './api';

class ClipboardMonitorService {
    private isMonitoring: boolean = false;
    private lastContent: string = '';
    private interval: NodeJS.Timeout | null = null;

    async startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        console.log('Started clipboard monitoring');

        this.interval = setInterval(async () => {
            try {
                const content = await Clipboard.getString();

                if (content && content !== this.lastContent && content.length > 0) {
                    this.lastContent = content;
                    await this.syncClipboard(content);
                }
            } catch (error) {
                console.error('Clipboard monitoring error:', error);
            }
        }, 1000); // Check every second
    }

    stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isMonitoring = false;
        console.log('Stopped clipboard monitoring');
    }

    private async syncClipboard(content: string) {
        try {
            // Encrypt content
            const { encrypted, iv } = await EncryptionService.encrypt(content);
            const hash = await EncryptionService.hash(content);
            const size = new Blob([content]).size;

            // Upload to backend
            await clipboardAPI.create({
                encrypted_content: encrypted,
                iv: iv,
                content_hash: hash,
                content_type: 'text',
                content_size: size,
            });

            console.log('Clipboard synced successfully');
        } catch (error) {
            console.error('Failed to sync clipboard:', error);
        }
    }

    async updateClipboard(content: string) {
        try {
            await Clipboard.setString(content);
            this.lastContent = content;
            console.log('Clipboard updated');
        } catch (error) {
            console.error('Failed to update clipboard:', error);
        }
    }
}

export default new ClipboardMonitorService();
