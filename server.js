require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/videoDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Define Schema
const videoSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    data: Buffer,
    metadata: String, // ✅ Store metadata
});

const Video = mongoose.model('Video', videoSchema);

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload endpoint
app.post('/upload', upload.single('video'), async (req, res) => {
    try {
        const { originalname, mimetype, buffer } = req.file;
        const metadata = req.body.metadata || '';

        const video = new Video({ filename: originalname, contentType: mimetype, data: buffer, metadata });
        await video.save();

        res.json({ message: 'Upload successful', videoId: video._id }); // ✅ Return video ID
    } catch (error) {
        res.status(500).json({ message: 'Upload failed', error });
    }
});

// Retrieve metadata (only metadata, not video data)
app.get('/videos/:id', async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        res.json({ metadata: video.metadata });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving metadata', error });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
