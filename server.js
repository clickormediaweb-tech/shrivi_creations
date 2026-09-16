require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Ye ek hi baar hona chahiye
app.use(express.json());


const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage Setup
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'shrivi_creations',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
    }
});
const upload = multer({ storage: storage });

// Naya Image Upload + Product Save API Route
app.post('/api/upload-product', upload.single('image'), async (req, res) => {
    try {
        const { name, price, cat } = req.body;
        const imageUrl = req.file.path; // Cloudinary se jo secure URL mila

        const newProduct = new Product({
            name,
            price: Number(price),
            img: imageUrl, // Asli cloud link save hoga
            cat
        });

        await newProduct.save();
        res.status(201).json({ success: true, message: "Product & Photo Uploaded Successfully!", data: newProduct });
    } catch (e) {
        res.status(500).json({ success: false, message: "Upload failed", error: e.message });
    }
});
// ==========================================
// 1. MONGODB CONNECTION & SEEDING
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB Atlas Connected Successfully!");
        seedProducts(); // Agar database khali hoga, toh ye apne aap products daal dega
    })
    .catch((error) => {
        console.log("❌ Database Connection Failed:", error.message);
    });


// ==========================================
// 2. MONGOOSE SCHEMAS & MODELS (Asli Database Structure)
// ==========================================

// User ka Data Model
const User = mongoose.model('User', new mongoose.Schema({
    name: { type: String },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "customer" }
}));

// Product ka Data Model
const Product = mongoose.model('Product', new mongoose.Schema({
    name: String, price: Number, img: String, cat: String
}));

// Order (Checkout) ka Data Model
const Order = mongoose.model('Order', new mongoose.Schema({
    orderId: String, 
    customerName: String, 
    items: Array, 
    totalAmount: Number, 
    status: { type: String, default: "Processing" }, 
    date: String
}));

// Feedback ka Data Model
const Feedback = mongoose.model('Feedback', new mongoose.Schema({
    name: String, email: String, message: String, date: String
}));


// Yeh function pehli baar mein aapke 6 products database mein daal dega
async function seedProducts() {
    const count = await Product.countDocuments();
    if(count === 0) {
        await Product.insertMany([
            { name: "Premium Maroon Cardigan", price: 6999, img: "2.jpg", cat: "new" },
            { name: "Classic Summer Tote", price: 4499, img: "3.jpg", cat: "new" },
            { name: "Elegant Pearl Scarf", price: 2999, img: "1.jpg", cat: "new" },
            { name: "Vintage Floral Top", price: 5999, img: "2.jpg", cat: "new" },
            { name: "Cozy Winter Cardigan", price: 7499, img: "1.jpg", cat: "shop" },
            { name: "Crochet Halter Neck", price: 3499, img: "3.jpg", cat: "shop" }
        ]);
        console.log("🛍️ Default Products Added to MongoDB Database!");
    }
}


// ==========================================
// 3. API ROUTES (Ab sab MongoDB se connected hain)
// ==========================================

// 🛍️ Get All Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json({ success: true, data: products });
    } catch(e) { res.status(500).json({ success: false }); }
});

// 🔐 User Signup
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        // Pehle check karo email pehle se hai ya nahi
        const exists = await User.findOne({ email });
        if(exists) return res.status(400).json({ success: false, message: "Email already registered!" });
        
        // Naya user Database mein save karo
        const newUser = new User({ name, email, password });
        await newUser.save();
        res.status(201).json({ success: true, message: "Account Created Successfully in Database!" });
    } catch(e) { res.status(500).json({ success: false, message: "Server Error" }); }
});

// 🔐 User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Demo OTP bypass code for frontend
        if(email === "demo@shrivi.com") return res.status(200).json({ success: true, message: "Logged in securely!" });
        
        const user = await User.findOne({ email, password });
        if(user) res.status(200).json({ success: true, message: `Welcome back, ${user.name || 'User'}!` });
        else res.status(401).json({ success: false, message: "Incorrect Credentials" });
    } catch(e) { res.status(500).json({ success: false }); }
});

// 🛒 Checkout / Order Save
app.post('/api/checkout', async (req, res) => {
    try {
        const { customer, items } = req.body;
        const newOrder = new Order({
            orderId: `ORD-${Date.now()}`,
            customerName: customer || "Guest Customer",
            items: items,
            totalAmount: items.reduce((sum, item) => sum + item.price, 0),
            date: new Date().toLocaleString()
        });
        await newOrder.save(); // Order MongoDB mein save ho raha hai
        res.status(200).json({ success: true, message: "Order placed securely in Database.", orderId: newOrder.orderId });
    } catch(e) { res.status(500).json({ success: false }); }
});
// ==========================================
// 🔐 AUTHENTICATION & OTP ROUTES
// ==========================================
let otpStorage = {};

// 1. Send OTP Route
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
        otpStorage[email] = generatedOtp;

        // Ye line aapke VS Code ke terminal mein OTP dikha degi
        console.log(`\n========================================`);
        console.log(`🔐 OTP for ${email} is: [ ${generatedOtp} ]`);
        console.log(`========================================\n`);

        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: '🔐 Shrivi Creations - Verification OTP',
                html: `<h3>Your secure OTP is: <b>${generatedOtp}</b></h3>`
            };
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            console.log("⚠️ Email restriction notice, but OTP is ready in terminal.");
        }

        res.status(200).json({ success: true, message: "OTP generated successfully!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to generate OTP" });
    }
});
app.post('/api/auth/send-otp', async (req, res) => {
    console.log("🔔 HIT MIL GAYA! Request aa gayi frontend se!"); // <--- Ye line sabse upar daal dein
    try {
        const { email } = req.body;
        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
        otpStorage[email] = generatedOtp;

        console.log(`🔐 OTP for ${email} is: [ ${generatedOtp} ]`);

        res.status(200).json({ success: true, message: "OTP generated successfully!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to generate OTP" });
    }
});
// 🔐 Send OTP Route
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
        otpStorage[email] = generatedOtp;

        console.log(`\n========================================`);
        console.log(`🔐 OTP for ${email} is: [ ${generatedOtp} ]`);
        console.log(`========================================\n`);

        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: '🔐 Shrivi Creations - Verification OTP',
                html: `<h3>Your secure OTP is: <b>${generatedOtp}</b></h3>`
            };
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            console.log("⚠️ Email restriction notice, but OTP is ready in terminal.");
        }

        res.status(200).json({ success: true, message: "OTP generated successfully!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to generate OTP" });
    }
});
// 2. Verify OTP Route
app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if(otpStorage[email] && otpStorage[email] === otp) {
        delete otpStorage[email];
        res.status(200).json({ success: true, message: "OTP Verified Successfully!" });
    } else {
        res.status(400).json({ success: false, message: "Invalid or Expired OTP!" });
    }
});
// 💬 Feedback Save
app.post('/api/feedback', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        const newFeedback = new Feedback({ name, email, message, date: new Date().toLocaleString() });
        await newFeedback.save(); // Feedback MongoDB mein save ho raha hai
        res.status(200).json({ success: true, message: "Feedback saved to Database." });
    } catch(e) { res.status(500).json({ success: false }); }
});

// 👨‍💻 Admin Login
app.post('/api/admin/login', (req, res) => {
    if (req.body.email === "admin@shrivi.com" && req.body.password === "admin123") {
        res.status(200).json({ success: true, message: "Admin Authenticated" });
    } else { res.status(401).json({ success: false, message: "Unauthorized" }); }
});
// 📦 Naya Product Add Karne Ka Route (Admin ke liye)
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, img, cat } = req.body;
        const newProduct = new Product({ name, price, img, cat });
        await newProduct.save();
        res.status(201).json({ success: true, message: "Premium Product Added Successfully!" });
    } catch(e) { 
        res.status(500).json({ success: false, message: "Error adding product" }); 
    }
});
// 📊 Admin Dashboard Data Route
app.get('/api/admin/dashboard', async (req, res) => {
    try {
        // Database se saare Orders aur Feedbacks nikalna (Latest pehle aayenge)
        const orders = await Order.find().sort({ _id: -1 }); 
        const feedbacks = await Feedback.find().sort({ _id: -1 });
        
        res.status(200).json({ 
            success: true, 
            data: { orders, feedbacks } 
        });
    } catch(e) { 
        res.status(500).json({ success: false, message: "Error fetching data" }); 
    }
});

app.listen(PORT, () => console.log(`🚀 API Live at http://localhost:${PORT}`));