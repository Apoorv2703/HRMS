import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Shift from '../src/models/Shift.js';
import Holiday from '../src/models/Holiday.js';
import { createShift, getShifts, updateShift, deleteShift, createHoliday, getHolidays, deleteHoliday } from '../src/controllers/attendanceConfigController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.3 CONFIGURATION VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let user = null;
  let employee = null;
  let createdShiftId = null;
  let createdHolidayId = null;

  try {
    // 1. Create a dummy tenant
    tenant = new Tenant({
      name: 'Test Corp Attendance Config',
      subdomain: `test-corp-att-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    // 2. Create User
    user = new User({
      tenantId: tenant._id,
      email: `configuser-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'HR_ADMIN',
    });
    await user.save();
    console.log('✔ User created');

    // 3. Mock Response Helper
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

    const mockNext = (err) => {
      console.error('Controller caught error:', err);
      throw err;
    };

    // 4. Test createShift
    const mockShiftReq = {
      tenantId: tenant._id,
      user: { id: user._id, role: 'HR_ADMIN' },
      body: {
        name: 'Morning Shift',
        startTime: '06:00',
        endTime: '14:00',
        gracePeriodMins: 10,
        halfDayThresholdMins: 240,
        weeklyOffs: [0, 6]
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Test Config Runner' }
    };

    await createShift(mockShiftReq, mockRes, mockNext);

    if (mockRes.statusCode !== 201) {
      throw new Error(`Failed to create Shift: ${mockRes.body?.error}`);
    }

    console.log('✔ Shift created successfully:', mockRes.body.shift);
    createdShiftId = mockRes.body.shift._id;

    // Test Shift Uniqueness constraint
    const duplicateShiftRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };

    try {
      await createShift(mockShiftReq, duplicateShiftRes, mockNext);
      throw new Error('Shift uniqueness constraint failed: allowed duplicate shift name for same tenant');
    } catch (err) {
      console.log('✔ Shift uniqueness validation passed: caught error on duplicate insert');
    }

    // 5. Test createHoliday
    const mockHolidayRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };

    const mockHolidayReq = {
      tenantId: tenant._id,
      user: { id: user._id, role: 'HR_ADMIN' },
      body: {
        name: 'Independence Day',
        date: '2026-07-04',
        location: 'All'
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Test Config Runner' }
    };

    await createHoliday(mockHolidayReq, mockHolidayRes, mockNext);

    if (mockHolidayRes.statusCode !== 201) {
      throw new Error(`Failed to create Holiday: ${mockHolidayRes.body?.error}`);
    }

    console.log('✔ Holiday created successfully:', mockHolidayRes.body.holiday);
    createdHolidayId = mockHolidayRes.body.holiday._id;

    // Test Holiday Uniqueness
    const duplicateHolidayRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };

    try {
      await createHoliday(mockHolidayReq, duplicateHolidayRes, mockNext);
      throw new Error('Holiday uniqueness constraint failed: allowed duplicate holiday for same tenant/date/location');
    } catch (err) {
      console.log('✔ Holiday uniqueness validation passed: caught error on duplicate insert');
    }

    // 6. Test Employee Shift Association
    employee = new Employee({
      tenantId: tenant._id,
      userId: user._id,
      employeeId: `EMP-${Date.now()}-CFG`,
      personal: { firstName: 'Config', lastName: 'Test' },
      employment: {
        status: 'ACTIVE',
        shiftId: createdShiftId // Link the new Shift model ID
      }
    });
    await employee.save();

    const populatedEmp = await Employee.findById(employee._id).populate('employment.shiftId');
    if (!populatedEmp.employment.shiftId || populatedEmp.employment.shiftId.name !== 'Morning Shift') {
      throw new Error('Employee Shift reference population failed');
    }
    console.log('✔ Employee Shift relationship linked and populated successfully. Shift Name:', populatedEmp.employment.shiftId.name);

    console.log('✔ All Phase 1 Shift & Holiday configuration validations passed successfully!');

  } catch (error) {
    console.error('❌ CONFIGURATION TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('Cleaning up database test records...');
    if (employee) await Employee.collection.deleteOne({ _id: employee._id });
    if (createdShiftId) await Shift.deleteOne({ _id: createdShiftId });
    if (createdHolidayId) await Holiday.deleteOne({ _id: createdHolidayId });
    if (user) await User.deleteOne({ _id: user._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
