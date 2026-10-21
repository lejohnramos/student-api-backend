// api/index.js
const connectToDatabase = require('../db');
const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  studentName: String,
  subjectName: String,
  section: String,
  dates: [{
    _id: false,
    date: Date,
    status: { type: String, enum: ['Present', 'Absent'] }
  }]
}, { timestamps: true });

// Third argument = the actual collection name in Atlas
const Student = mongoose.models.Student ||
  mongoose.model('Student', StudentSchema, 'daily_attendance');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectToDatabase();

    // GET: list all students
    if (req.method === 'GET') {
      const students = await Student.find({}).sort({ studentName: 1 });
      return res.status(200).json(students);
    }

    // POST: add a student (no id) or mark attendance (with id)
    if (req.method === 'POST') {
      const { id, status, date, studentName, subjectName, section } = req.body;

      if (!id) {
        if (!studentName) return res.status(400).json({ error: 'studentName is required' });
        const created = await Student.create({ studentName, subjectName, section, dates: [] });
        return res.status(201).json(created);
      }

      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
      if (!['Present', 'Absent'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      if (!date) return res.status(400).json({ error: 'date is required' });

      const student = await Student.findById(id);
      if (!student) return res.status(404).json({ error: 'Student not found' });

      const day = new Date(date); // "YYYY-MM-DD" parses to UTC midnight
      const entry = student.dates.find(d => d.date.toISOString().slice(0, 10) === date);
      if (entry) entry.status = status;
      else student.dates.push({ date: day, status });

      await student.save();
      return res.status(200).json(student);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database connection failed' });
  }
};
