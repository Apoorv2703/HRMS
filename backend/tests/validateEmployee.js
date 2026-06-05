import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import { hasCircularReporting, inviteEmployee } from '../src/controllers/employeeController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.2 SCHEMAS & LOGIC VERIFICATION ---');

  // Connect to database (uses connection string from environment)
  await connectDB();

  let tenant = null;
  let userA = null;
  let userB = null;
  let userC = null;
  let empA = null;
  let empB = null;
  let empC = null;

  try {
    // 1. Create a dummy tenant
    tenant = new Tenant({
      name: 'Test Corp 6.2',
      subdomain: `test-corp-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    // 2. Create Users
    userA = new User({
      tenantId: tenant._id,
      email: `empa-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'HR_ADMIN',
    });
    await userA.save();

    userB = new User({
      tenantId: tenant._id,
      email: `empb-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await userB.save();

    userC = new User({
      tenantId: tenant._id,
      email: `empc-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await userC.save();
    console.log('✔ User logins created');

    // 3. Create Employees
    empA = new Employee({
      tenantId: tenant._id,
      userId: userA._id,
      employeeId: `EMP-${Date.now()}-A`,
      personal: { firstName: 'Employee', lastName: 'A' },
      employment: { status: 'ACTIVE' },
    });
    await empA.save();

    empB = new Employee({
      tenantId: tenant._id,
      userId: userB._id,
      employeeId: `EMP-${Date.now()}-B`,
      personal: { firstName: 'Employee', lastName: 'B' },
      employment: { status: 'ACTIVE', reportingManagerId: empA._id },
    });
    await empB.save();

    empC = new Employee({
      tenantId: tenant._id,
      userId: userC._id,
      employeeId: `EMP-${Date.now()}-C`,
      personal: { firstName: 'Employee', lastName: 'C' },
      employment: { status: 'ACTIVE', reportingManagerId: empB._id },
    });
    await empC.save();
    console.log('✔ Employees registered in hierarchy (A <- B <- C)');

    // 4. Test Circular Reporting Check
    console.log('Testing Circular Reporting Checks...');
    
    // Normal reporting (B reports to A, C reports to B)
    const isNormal1 = await hasCircularReporting(empB._id, empA._id);
    const isNormal2 = await hasCircularReporting(empC._id, empB._id);
    console.log(`  - Standard hierarchy check (should be false/false): ${isNormal1} / ${isNormal2}`);
    if (isNormal1 || isNormal2) throw new Error('Failed normal reporting check');

    // Cycle: A tries to report to B (A <- B <- A)
    const isCircular1 = await hasCircularReporting(empA._id, empB._id);
    console.log(`  - A reports to B cycle check (should be true): ${isCircular1}`);
    if (!isCircular1) throw new Error('Failed to detect A -> B cycle');

    // Cycle: A tries to report to C (A <- B <- C <- A)
    const isCircular2 = await hasCircularReporting(empA._id, empC._id);
    console.log(`  - A reports to C cycle check (should be true): ${isCircular2}`);
    if (!isCircular2) throw new Error('Failed to detect A -> C cycle');

    console.log('✔ Circular Reporting check succeeded');

    // 5. Test Delete Block
    console.log('Testing Employee Delete Block...');
    try {
      await Employee.deleteOne({ _id: empA._id });
      throw new Error('Employee deletion succeeded when it should have failed');
    } catch (err) {
      if (err.message.includes('Physical deletion of employee records is prohibited')) {
        console.log('  - Delete blocker validation passed: caught error successfully.');
      } else {
        throw err;
      }
    }
    console.log('✔ Delete blockers validation succeeded');

    // 6. Test Auto-Generated Employee ID & Extensions
    console.log('Testing Auto-Generation of ID and Extension Fields...');
    let testInviteCode = null;
    let testEmpId = null;
    
    // Mock response handler
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
      user: { id: userA._id },
      body: {
        workEmail: `autoemp-${Date.now()}@test.com`,
        personal: {
          firstName: 'Auto',
          lastName: 'Employee'
        },
        employment: {
          department: 'Engineering',
          location: 'Headquarters',
          assignedShift: 'Morning Shift',
          employmentType: 'INTERN'
        },
        professional: {
          education: [{ institution: 'Stanford University', degree: 'MS', fieldOfStudy: 'CS', startYear: '2020', endYear: '2022' }],
          experience: [{ company: 'Google', designation: 'Intern', startDate: new Date('2021-06-01'), endDate: new Date('2021-08-31'), description: 'SWE Intern' }],
          skills: ['Javascript', 'React'],
          certifications: [{ name: 'AWS Cloud Practitioner', issuer: 'Amazon', issueDate: new Date('2022-01-01'), expiryDate: new Date('2025-01-01'), credentialId: 'AWS-1234' }]
        }
      }
    };
    
    const mockNext = (err) => {
      console.error('inviteEmployee caught error in next:', err);
      throw err;
    };
    
    await inviteEmployee(mockReq, mockRes, mockNext);
    
    if (mockRes.statusCode !== 201) {
      throw new Error(`Failed to invite employee with auto-generated ID: ${mockRes.body?.error}`);
    }
    
    testInviteCode = mockRes.body.inviteCode;
    testEmpId = mockRes.body.employee.id;
    console.log(`  - Onboarded Employee via controller. Generated ID: ${mockRes.body.employee.employeeId}`);
    
    if (!mockRes.body.employee.employeeId.startsWith('EMP-')) {
      throw new Error(`Auto-generated ID format invalid: ${mockRes.body.employee.employeeId}`);
    }
    
    const savedEmp = await Employee.findById(testEmpId);
    if (!savedEmp) throw new Error('Saved employee not found in database');
    
    console.log(`  - Persisted Assigned Shift check (Morning Shift): ${savedEmp.employment.assignedShift}`);
    if (savedEmp.employment.assignedShift !== 'Morning Shift') throw new Error('Assigned shift did not persist');
    
    console.log(`  - Persisted Employment Type check (INTERN): ${savedEmp.employment.employmentType}`);
    if (savedEmp.employment.employmentType !== 'INTERN') throw new Error('Employment type did not persist');

    console.log(`  - Persisted Skills check (Javascript, React): ${savedEmp.professional.skills.join(', ')}`);
    if (!savedEmp.professional.skills.includes('React')) throw new Error('Skills did not persist');

    console.log(`  - Persisted Education institution check: ${savedEmp.professional.education[0]?.institution}`);
    if (savedEmp.professional.education[0]?.institution !== 'Stanford University') throw new Error('Education did not persist');

    console.log(`  - Persisted Experience company check: ${savedEmp.professional.experience[0]?.company}`);
    if (savedEmp.professional.experience[0]?.company !== 'Google') throw new Error('Experience did not persist');

    console.log(`  - Persisted Certification name check: ${savedEmp.professional.certifications[0]?.name}`);
    if (savedEmp.professional.certifications[0]?.name !== 'AWS Cloud Practitioner') throw new Error('Certification did not persist');
    
    console.log('✔ Auto-Generation & Extension Fields validation succeeded');

    // Clean up local reference variables for finally block
    global.testEmpIdToDelete = testEmpId;

  } catch (testError) {
    console.error('❌ VALIDATION TEST FAILED:', testError);
    process.exitCode = 1;
  } finally {
    // Cleanup using native driver to bypass pre-hooks
    console.log('Cleaning up database test records...');
    if (global.testEmpIdToDelete) {
      try {
        const dbEmp = await Employee.findById(global.testEmpIdToDelete);
        if (dbEmp) {
          await User.deleteOne({ _id: dbEmp.userId });
          await Employee.collection.deleteOne({ _id: dbEmp._id });
        }
      } catch (cleanupErr) {
        console.error('Failed to clean up test invite', cleanupErr);
      }
    }
    if (empA) await Employee.collection.deleteOne({ _id: empA._id });
    if (empB) await Employee.collection.deleteOne({ _id: empB._id });
    if (empC) await Employee.collection.deleteOne({ _id: empC._id });
    if (userA) await User.deleteOne({ _id: userA._id });
    if (userB) await User.deleteOne({ _id: userB._id });
    if (userC) await User.deleteOne({ _id: userC._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
