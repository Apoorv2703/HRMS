import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import fs from 'fs';
import path from 'path';
import { uploadDocument, deleteDocument } from '../src/controllers/employeeController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.2 DOCUMENT STORAGE VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let user = null;
  let employee = null;
  let createdDocId = null;

  try {
    // 1. Create a dummy tenant
    tenant = new Tenant({
      name: 'Test Corp Docs',
      subdomain: `test-corp-docs-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    // 2. Create User
    user = new User({
      tenantId: tenant._id,
      email: `empdoc-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'HR_ADMIN', // HR Admin is allowed to upload
    });
    await user.save();
    console.log('✔ User created');

    // 3. Create Employee
    employee = new Employee({
      tenantId: tenant._id,
      userId: user._id,
      employeeId: `EMP-${Date.now()}-DOC`,
      personal: { firstName: 'Doc', lastName: 'Test' },
      employment: { status: 'ACTIVE' },
    });
    await employee.save();
    console.log('✔ Employee created');

    // 4. Mock a Multer file upload
    const mockFile = {
      originalname: 'test_contract.pdf',
      buffer: Buffer.from('%PDF-1.4 dummy pdf content'),
      mimetype: 'application/pdf',
      size: 25,
    };

    // 5. Test uploadDocument controller
    const mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };

    const mockReq = {
      tenantId: tenant._id,
      user: { id: user._id, role: 'HR_ADMIN' },
      params: { id: employee._id.toString() },
      body: {
        name: 'Employment Contract 2026',
        type: 'CONTRACT',
      },
      file: mockFile,
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Test Runner',
      },
    };

    const mockNext = (err) => {
      console.error('uploadDocument caught error:', err);
      throw err;
    };

    await uploadDocument(mockReq, mockRes, mockNext);

    if (mockRes.statusCode !== 201) {
      throw new Error(`Failed to upload document: ${mockRes.body?.error}`);
    }

    console.log('✔ uploadDocument controller returned 201 successfully');
    console.log('Returned document details:', mockRes.body.document);

    const doc = mockRes.body.document;
    createdDocId = doc._id;

    // Verify it was appended to employee's documents in DB
    const updatedEmp = await Employee.findById(employee._id);
    if (updatedEmp.documents.length !== 1) {
      throw new Error(`Expected employee documents to have 1 entry, got ${updatedEmp.documents.length}`);
    }
    console.log('✔ Document saved to employee subdocument array');

    // Verify file exists on local disk (if S3 is not configured)
    const fileUrl = doc.fileUrl;
    if (fileUrl.startsWith('/uploads/')) {
      const fileName = fileUrl.split('/uploads/')[1];
      const filePath = path.join(path.resolve('uploads'), fileName);
      if (fs.existsSync(filePath)) {
        console.log('✔ Local fallback file exists in uploads directory:', filePath);
      } else {
        throw new Error(`Local file not found: ${filePath}`);
      }
    } else {
      console.log('✔ File was uploaded to S3:', fileUrl);
    }

    // 6. Test deleteDocument controller
    const mockDelRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };

    const mockDelReq = {
      tenantId: tenant._id,
      user: { id: user._id, role: 'HR_ADMIN' },
      params: {
        id: employee._id.toString(),
        docId: createdDocId.toString(),
      },
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Test Runner',
      },
    };

    await deleteDocument(mockDelReq, mockDelRes, mockNext);

    if (mockDelRes.statusCode !== 200) {
      throw new Error(`Failed to delete document: ${mockDelRes.body?.error}`);
    }

    console.log('✔ deleteDocument controller returned 200 successfully');

    // Verify it was pulled from DB
    const finalEmp = await Employee.findById(employee._id);
    if (finalEmp.documents.length !== 0) {
      throw new Error('Expected employee documents array to be empty after deletion');
    }
    console.log('✔ Document pulled from employee subdocument array');

    // Verify file is deleted from local disk (if it was local)
    if (fileUrl.startsWith('/uploads/')) {
      const fileName = fileUrl.split('/uploads/')[1];
      const filePath = path.join(path.resolve('uploads'), fileName);
      if (!fs.existsSync(filePath)) {
        console.log('✔ Local file successfully removed from disk');
      } else {
        throw new Error(`Local file still exists after deletion: ${filePath}`);
      }
    }

    console.log('✔ All document storage tests passed successfully!');

  } catch (error) {
    console.error('❌ DOCUMENT STORAGE TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('Cleaning up database test records...');
    if (employee) await Employee.collection.deleteOne({ _id: employee._id });
    if (user) await User.deleteOne({ _id: user._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
