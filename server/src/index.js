// import express from 'express';
// import cors from 'cors';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import fs from 'fs';

// import authRoutes from './routes/auth.js';
// import eventRoutes from './routes/events.js';
// import photoRoutes from './routes/photos.js';
// import searchRoutes from './routes/search.js';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// const uploadsRoot = path.join(__dirname, '..', 'uploads');
// fs.mkdirSync(uploadsRoot, { recursive: true });

// const app = express();
// const PORT = process.env.PORT || 4000;

// app.use(cors());
// app.use(express.json({ limit: '10mb' }));
// app.use('/uploads', express.static(uploadsRoot));

// app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'facevault-api' }));

// app.use('/api/auth', authRoutes);
// app.use('/api/events', eventRoutes);
// app.use('/api/photos', photoRoutes);
// app.use('/api/search', searchRoutes);

// app.use((err, req, res, next) => {
//   console.error(err);
//   res.status(err.status || 500).json({ error: err.message || 'Something went wrong on the server' });
// });

// app.listen(PORT, () => {
//   console.log(`FaceVault API running on http://localhost:${PORT}`);
// });


// import express from 'express';
// import cors from 'cors';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import fs from 'fs';
// import multer from 'multer'; // Add this import
// import 'dotenv/config';
// import authRoutes from './routes/auth.js';
// import eventRoutes from './routes/events.js';
// import photoRoutes from './routes/photos.js';
// import searchRoutes from './routes/search.js';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// const uploadsRoot = path.join(__dirname, '..', 'uploads');
// fs.mkdirSync(uploadsRoot, { recursive: true });

// const publicDri=path.join(__dirname,"public")

// const app = express();
// const PORT = process.env.PORT || 4000;

// app.use(cors());
// app.use(express.json({ limit: '10mb' }));
// app.use(express.static(publicDri))
// app.use('/uploads', express.static(uploadsRoot));

// app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'facevault-api' }));

// app.use('/api/auth', authRoutes);
// app.use('/api/events', eventRoutes);
// app.use('/api/photos', photoRoutes);
// app.use('/api/search', searchRoutes);


// app.use(express.json({ limit: '50mb' })); // Increased from 10mb
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// // Add Multer error handler here (before the generic error handler)
// app.use((err, req, res, next) => {
//   if (err instanceof multer.MulterError) {
//     if (err.code === 'LIMIT_FILE_SIZE') {
//       return res.status(400).json({ 
//         error: 'File too large. Maximum file size is 50MB. Please compress your images or upload smaller files.' 
//       });
//     }
//     return res.status(400).json({ error: err.message });
//   }
//   next(err);
// });

// // Generic error handler
// app.use((err, req, res, next) => {
//   console.error(err);
//   res.status(err.status || 500).json({ error: err.message || 'Something went wrong on the server' });
// });

// app.get("*name",(req,res)=>{
//   res.sendFile(path.join(publicDri,"index.html"))
// })

// app.listen(PORT, () => {
//   console.log(`FaceVault API running on http://localhost:${PORT}`);
// });


import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import 'dotenv/config';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import photoRoutes from './routes/photos.js';
import searchRoutes from './routes/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const uploadsRoot = path.join(__dirname, '..', 'uploads');
const publicDir = path.join(__dirname, 'public');

fs.mkdirSync(uploadsRoot, { recursive: true });

const app = express();

const PORT = process.env.PORT || 4000;

/*
|--------------------------------------------------------------------------
| Global Middleware
|--------------------------------------------------------------------------
*/

app.use(cors());

app.use(
  express.json({
    limit: '50mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb'
  })
);

/*
|--------------------------------------------------------------------------
| Static Files
|--------------------------------------------------------------------------
*/

app.use(express.static(publicDir));

app.use(
  '/uploads',
  express.static(uploadsRoot)
);

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'facevault-api'
  });
});

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

app.use('/api/auth', authRoutes);

app.use('/api/events', eventRoutes);

app.use('/api/photos', photoRoutes);

app.use('/api/search', searchRoutes);

/*
|--------------------------------------------------------------------------
| Frontend SPA Fallback
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This must come AFTER all API routes.
|
*/

app.get('*', (req, res) => {
  res.sendFile(
    path.join(publicDir, 'index.html')
  );
});

/*
|--------------------------------------------------------------------------
| Multer Error Handler
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error:
          'File too large. Maximum file size is 50MB. Please compress your images or upload smaller files.'
      });
    }

    return res.status(400).json({
      error: err.message
    });
  }

  next(err);
});

/*
|--------------------------------------------------------------------------
| Generic Error Handler
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {
  console.error('[FaceVault] Server error:', err);

  res.status(err.status || 500).json({
    error:
      err.message ||
      'Something went wrong on the server'
  });
});

/*
|--------------------------------------------------------------------------
| Start Server & Connect DB
|--------------------------------------------------------------------------
*/

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('[FaceVault] Connected to MongoDB successfully.');
    app.listen(PORT, () => {
      console.log(
        `[FaceVault] API running on http://localhost:${PORT}`
      );
      console.log(
        `[FaceVault] Health check: http://localhost:${PORT}/api/health`
      );
    });
  })
  .catch((err) => {
    console.error('[FaceVault] MongoDB connection failed:', err.message);
  });
