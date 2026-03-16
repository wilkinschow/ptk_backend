require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
// const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/videoDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const videoSchema = new mongoose.Schema({
    uuid: String,
    media_uuid: String,
    name: String,
    size: String,
    videoURL: String,
    videoDuration: String,
    submissionDate: String,
    isValidVideo: Boolean,
    videoDesc: String,
    addDesc: String,
    incidentType: String,
    severity: Number,
    authenticity: Number,
    location: String,
    summary: String,
    isProcessed: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Video = mongoose.model('Video', videoSchema);
app.get('/fetchData', async (req, res) => {
  const data = await Video.find();
  res.json(data);
});

// Multer setup
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// Upload endpoint
// app.post('/upload2', upload.single('video'), async (req, res) => {
//     try {
//         const { originalname, mimetype, buffer } = req.file;
//         const metadata = req.body.metadata || '';

//         const video = new Video({ filename: originalname, contentType: mimetype, data: buffer, metadata });
//         await video.save();

//         res.json({ message: 'Upload successful', videoId: video._id }); // ✅ Return video ID
//     } catch (error) {
//         res.status(500).json({ message: 'Upload failed', error });
//     }
// });

app.post('/upload', async (req, res) => {
    try {
        console.log('BODY RECEIVED:', req.body);

        const video = new Video(req.body);
        await video.save();

        res.json({
            message: 'Metadata saved successfully',
            videoId: video._id,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// Retrieve metadata (only metadata, not video data)
app.get('/videos/:id', async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        res.json(video); // return full structured object

    } catch (error) {
        res.status(500).json({ message: 'Error retrieving metadata', error });
    }
});


app.listen(3000, () => console.log('Server running on port 3000'));
