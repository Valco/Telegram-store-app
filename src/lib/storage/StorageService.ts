import fs from 'fs';
import path from 'path';

export interface StorageServiceInterface {
  uploadFile(file: Buffer, fileName: string, targetFolder?: string): Promise<string>;
  deleteFile(fileUrl: string): Promise<boolean>;
}

export class LocalStorageService implements StorageServiceInterface {
  private baseUploadFolder: string;

  constructor() {
    // We will store files in the root folder /uploads/
    this.baseUploadFolder = path.join(process.cwd(), 'uploads');
    
    // Ensure base directory exists
    if (!fs.existsSync(this.baseUploadFolder)) {
      fs.mkdirSync(this.baseUploadFolder, { recursive: true });
    }
  }

  async uploadFile(file: Buffer, fileName: string, targetFolder: string = ''): Promise<string> {
    const folderPath = path.join(this.baseUploadFolder, targetFolder);
    
    // Ensure target folder exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
    const filePath = path.join(folderPath, uniqueFileName);

    await fs.promises.writeFile(filePath, file);

    // Return the relative URL so it can be served via an API route like /api/files/:path
    // Example: /api/files/images/123123-pic.jpg
    const relativeUrlPath = targetFolder ? `${targetFolder}/${uniqueFileName}` : uniqueFileName;
    return `/api/files/${relativeUrlPath}`;
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // Assuming fileUrl matches /api/files/(.+)
      const relativePath = fileUrl.replace('/api/files/', '');
      const filePath = path.join(this.baseUploadFolder, relativePath);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error deleting file', e);
      return false;
    }
  }
}

// In the future, we can add S3StorageService and just swap the default export
// export class S3StorageService implements StorageServiceInterface { ... }

export const storageService: StorageServiceInterface = new LocalStorageService();
