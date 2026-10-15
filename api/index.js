// api/index.js
const connectToDatabase = require('../db');
const mongoose = require('mongoose');

// Same structure as the daily_attendance collection in LabAttendanceDB_Ramos
const AttendanceSchema = new mongoose.Schema(
  {
    studentName: String,
    subjectName: String,
    section: String,
    dates: [
      {
        _id: false,
        date: Date,
        status: { type: String, enum: ['Present', 'Absent'] },
      },
    ],
  },
  { collection: 'daily_attendance' }
);

const Attendance =
  mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

module.exports = async (req, res) => {
  // Enable CORS so GitHub Pages can communicate with this API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectToDatabase();

    // GET: list all students with their attendance
    if (req.method === 'GET') {
      const students = await Attendance.find({}).sort({
        subjectName: 1,
        section: 1,
        studentName: 1,
      });
      return res.status(200).json(students);
    }

    // POST: mark a student Present/Absent for a date
    // body: { id, status, date }  (date is "YYYY-MM-DD", optional, defaults to today)
    if (req.method === 'POST') {
      const { id, status, date } = req.body || {};

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid student id' });
      }
      if (!['Present', 'Absent'].includes(status)) {
        return res.status(400).json({ error: 'Status must be Present or Absent' });
      }

      const day = date ? new Date(date) : new Date();
      if (isNaN(day.getTime())) {
        return res.status(400).json({ error: 'Invalid date' });
      }
      day.setUTCHours(0, 0, 0, 0);

      const student = await Attendance.findById(id);
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // If that day already exists, change its status. Otherwise add it.
      const existing = student.dates.find(
        (d) => d.date.getTime() === day.getTime()
      );
      if (existing) {
        existing.status = status;
      } else {
        student.dates.push({ date: day, status });
      }
      await student.save();

      return res.status(200).json(student);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
       return res.status(500).json({ error: error.message });
  }
};
