require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.patch('/videos/:id', async (req, res) => {
    try {
        const { field, value } = req.body;

        if (!field) {
            return res.status(400).json({ message: 'Field is required' });
        }

        const allowedFields = [
            'name',
            'videoDesc',
            'addDesc',
            'incidentType',
            'severity',
            'authenticity',
            'location',
            'summary',
            'isProcessed'
        ];

        if (!allowedFields.includes(field)) {
            return res.status(400).json({ message: 'Invalid field' });
        }

        const updatedVideo = await Video.findByIdAndUpdate(
            req.params.id,
            { $set: { [field]: value } },
            { new: true, runValidators: true }
        );

        if (!updatedVideo) {
            return res.status(404).json({ message: 'Video not found' });
        }

        res.json({
            message: `Field '${field}' updated successfully`,
            data: updatedVideo
        });

    } catch (error) {
        res.status(500).json({ message: 'Update failed', error: error.message });
    }
});




// CRITICAL: This must be present to read the 'rowId' from your fetch request
app.use(express.json());

app.post('/api/generate-pdf', async (req, res) => {
    const { data } = req.body; // This is the object sent from frontend

    if (!data) {
        return res.status(400).send("No data provided");
    }
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        const severity = Object.freeze({
            0: "Unassigned",
            1: "Low",
            2: "Medium",
            3: "High",
        });
        
        const date = new Date(data.createdAt);

        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'long' });
        const year = date.getFullYear();
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'

        const formattedDate = `${day} ${month} ${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
        console.log(formattedDate);

        // Read logo as base64 for watermark
        const logoPath = path.join(__dirname, 'public', 'logo.png');
        const logoBase64 = fs.readFileSync(logoPath, 'base64');
        const logoDataUrl = `data:image/png;base64,${logoBase64}`;

        // Fetch thumbnails from VLM
        const thumbnailsResponse = await fetch(`http://localhost:4000/thumbnails/${data.media_uuid}`);
        const thumbnailsData = await thumbnailsResponse.json();
        const thumbnails = thumbnailsData.thumbnails || [];

        // Select first and middle thumbnails
        const firstThumbnail = thumbnails[0];
        const middleIndex = Math.floor(thumbnails.length / 2);
        const middleThumbnail = thumbnails[middleIndex];

        // Build full URLs
        const firstImageUrl = `http://localhost:4000/thumbnails/${data.media_uuid}/${firstThumbnail.filename}`;
        const middleImageUrl = `http://localhost:4000/thumbnails/${data.media_uuid}/${middleThumbnail.filename}`;

        // 1. Define your HTML Template with Styles
        const htmlContent = `
        <html lang="en">
            <head>
                <style>
                    body { font-family: Inter,serif; padding: 40px; color: #333; position: relative; }
                    td {font-family: Inter,serif; color: #333;}
                    .label { font-weight: bold; color: #555; }
                    .row { margin-bottom: 10px; display: flex}
                    .field { flex: 1; display: flex; flex-direction: column; border: 1px solid rgba(0, 0, 0, 0.5); padding: 5px}
                    .watermark {
                        position: fixed;
                        top: 0;
                        left: 20%;
                        width: 30%;
                        height: 30%;
                        opacity: 0.2;
                        z-index: -1;
                        pointer-events: none;
                    }
                </style>
            </head>
            <body>
                <img src="${logoDataUrl}" class="watermark" style="object-fit: contain; width: 60%; height: 60%;">
                <table style="width: 100%; border-collapse: collapse; ">
                  <tr style="border: 1px solid rgba(118, 118, 118, 0.5);">
                    <td colspan="2" style="padding: 10px;"><span class="label" style="display: block">Date/Time Report Made</span> ${formattedDate || 'N/A'}</td>
                    <td colspan="2" style="padding: 10px; border-left: 1px solid rgba(118, 118, 118, 0.1); border-right: 1px solid rgba(118, 118, 118, 0.1);"><span class="label" style="display: block">Case ID</span> ${data.uuid || 'None'}</td>
                    <td colspan="2" style="padding: 10px;"><span class="label" style="display: block">Severity</span> ${severity[data.severity] || 'None'}</td>
                  </tr>
                  <tr style="border: 1px solid rgba(118, 118, 118, 0.5);">
                    <td colspan="2" style="padding: 10px; border-right: 1px solid rgba(118, 118, 118, 0.1)"><span class="label" style="display: block">Incident Type</span>${data.incidentType || 'N/A'}</td>
                    <td colspan="4" style="padding: 10px;"><span class="label" style="display: block">Location of Incident</span>${data.location || 'N/A'}</td>
                  </tr>
                  <tr style="border: 1px solid rgba(118, 118, 118, 0.5);">
                    <td colspan="6" style="padding: 10px; border-top: 1px solid rgba(118, 118, 118, 0.1); white-space: pre-wrap;"><span class="label" style="display: block">Incident Details</span>${data.videoDesc || 'N/A'}</td>
                  </tr>
                </table>
                <h3 style="font-family: sans-serif; margin-top: 20px; font-size: 16px;">Attachments</h3>
                <div style="display: flex; gap: 20px; margin-top: 10px;">
                  <div style="flex: 1;">
                    <img src="${firstImageUrl}" style="width: 100%; height: 200px; object-fit: cover; border: 1px solid #ccc;">
                    <p style="text-align: center; font-family: sans-serif; font-size: 12px; margin-top: 5px; color: #555;">Image 1</p>
                  </div>
                  <div style="flex: 1;">
                    <img src="${middleImageUrl}" style="width: 100%; height: 200px; object-fit: cover; border: 1px solid #ccc;">
                    <p style="text-align: center; font-family: sans-serif; font-size: 12px; margin-top: 5px; color: #555;">Image 2</p>
                  </div>
                </div>
            </body>
        </html>`;

        // 2. Set the content directly
        await page.setContent(htmlContent, { waitUntil: 'networkidle' });

        // 3. Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });

        await browser.close();
        res.contentType("application/pdf");
        res.send(pdfBuffer);

    } catch (err) {
        console.error("PDF Generation Error:", err);
        if (browser) await browser.close();
        res.status(500).send("Error generating PDF");
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
