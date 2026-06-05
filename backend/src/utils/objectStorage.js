import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const useS3 = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_REGION &&
  process.env.AWS_S3_BUCKET
);

let s3Client = null;
if (useS3) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Uploads a file buffer to S3 or saves it locally.
 * @param {Object} file - Multer file object
 * @param {string} tenantId - Tenant ID
 * @param {string} employeeId - Employee ID
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
export const uploadFile = async (file, tenantId, employeeId) => {
  const fileExt = path.extname(file.originalname);
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${fileExt}`;

  if (useS3) {
    const key = `tenants/${tenantId}/employees/${employeeId}/${uniqueName}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } else {
    // Fallback: save locally
    const uploadDir = path.resolve('uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, file.buffer);
    
    // Return relative path served statically by Express
    return `/uploads/${uniqueName}`;
  }
};

/**
 * Deletes a file from S3 or local system.
 * @param {string} fileUrl - Public URL of the file
 * @returns {Promise<void>}
 */
export const deleteFile = async (fileUrl) => {
  if (!fileUrl) return;

  if (useS3 && fileUrl.includes('amazonaws.com')) {
    try {
      const bucket = process.env.AWS_S3_BUCKET;
      const key = fileUrl.split(`${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/`)[1];
      if (key) {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );
      }
    } catch (err) {
      console.error('Failed to delete S3 object:', err);
    }
  } else if (fileUrl.startsWith('/uploads/')) {
    try {
      const fileName = fileUrl.split('/uploads/')[1];
      const filePath = path.join(path.resolve('uploads'), fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('Failed to delete local file:', err);
    }
  }
};
