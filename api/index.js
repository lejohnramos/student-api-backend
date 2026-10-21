// api/index.js
const connectToDatabase = require('../db');
const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  studentName: String,
  subjectName: String,
  section: String,
  dates: [{
    date: Date,
    status: { type: String, enum: ['Present', 'Absent'] }
  }]
});

const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectToDatabase();

    if (req.method === 'GET') {
      const students = await Student.find({}).sort({ studentName: 1 });
      return res.status(200).json(students);
    }

    if (req.method === 'POST') {
      const { id, status, date } = req.body;
      if (!id || !['Present', 'Absent'].includes(status) || !date) {
        return res.status(400).json({ error: 'id, status and date are required' });
      }
      const student = await Student.findById(id);
      if (!student) return res.status(404).json({ error: 'Student not found' });

      // Store at UTC midnight so it matches the frontend's date.slice(0, 10)
      const day = new Date(date + 'T00:00:00.000Z');
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
