// api/index.js
const connectToDatabase = require('../db');
const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  studentName: String,
  subjectName: String,
  section: String,
  dates: [{
    _id: false,
    date: Date,                                   // the attendance day (UTC midnight)
    status: { type: String, enum: ['Present', 'Absent'] },
    markedAt: Date                                // exact moment the button was clicked
  }]
}, { timestamps: true });

const Student = mongoose.models.Student ||
  mongoose.model('Student', StudentSchema, 'daily_attendance');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');     // always return fresh data

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectToDatabase();

    // READ: list all students
    if (req.method === 'GET') {
      const students = await Student.find({}).sort({ studentName: 1 });
      return res.status(200).json(students);
    }

    // CREATE a student (no id) or mark attendance (with id)
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

      const now = new Date();
      const entry = student.dates.find(d => d.date.toISOString().slice(0, 10) === date);
      if (entry) {
        entry.status = status;
        entry.markedAt = now;
      } else {
        student.dates.push({ date: new Date(date), status, markedAt: now });
      }

      await student.save();
      return res.status(200).json(student);
    }

    // UPDATE: edit a student's name, subject, or section
    if (req.method === 'PUT') {
      const { id, studentName, subjectName, section } = req.body;

      if (!id || !mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
      if (!studentName || !subjectName || !section) {
        return res.status(400).json({ error: 'studentName, subjectName and section are required' });
      }

      const updated = await Student.findByIdAndUpdate(
        id,
        { studentName, subjectName, section },
        { new: true, runValidators: true }
      );
      if (!updated) return res.status(404).json({ error: 'Student not found' });
      return res.status(200).json(updated);
    }

    // DELETE: remove a student (id comes from the query string: ?id=...)
    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || (req.body && req.body.id);

      if (!id || !mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });

      const deleted = await Student.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ error: 'Student not found' });
      return res.status(200).json({ ok: true, _id: id });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database connection failed' });
  }
};
