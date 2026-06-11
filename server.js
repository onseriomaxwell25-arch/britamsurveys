
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Low, JSONFile } = require("lowdb");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey"; // In production, use a strong, environment-variable-based secret
const ADMIN_USERNAME = "admin_Maxi@2007";
const ADMIN_PASSWORD = "2007"; // In a real app, this would be hashed and stored securely
const MPESA_NUMBER = "0755920815";

// --- Database Setup ---
const file = path.join(__dirname, "db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter);

// Initialize database with default structure if it doesn't exist
async function initializeDb() {
  await db.read();
  db.data = db.data || { users: [], analytics: [], questions: [] };
  // Add admin user if not exists
  if (!db.data.users.find((u) => u.username === ADMIN_USERNAME)) {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    db.data.users.push({
      id: "admin001",
      name: "Admin Maxi",
      email: "admin@britam.com",
      username: ADMIN_USERNAME,
      password: hashedPassword,
      package: "vip",
      balance: 0,
      totalEarned: 0,
      surveysAnswered: 0,
      joinDate: new Date().toISOString(),
      referralCode: "ADMINREF",
      referrals: 0,
      isAdmin: true,
      verified: true,
      surveyHistory: {},
      transactions: [],
      notifications: [],
    });
  }
  await db.write();
}

initializeDb();

// --- Express App Setup ---
const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- Helper Functions ---
function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function addNotification(userId, type, icon, title, message) {
  const user = db.data.users.find((u) => u.id === userId);
  if (user) {
    user.notifications.unshift({
      id: Date.now(),
      type: type,
      icon: icon,
      title: title,
      message: message,
      read: false,
      date: new Date().toISOString(),
    });
  }
}

function getDailyQuestions() {
  const today = new Date().toDateString();
  let dailyQuestions = db.data.questions.filter((q) => q.date === today);

  if (dailyQuestions.length === 0) {
    // Generate new questions if none for today
    const newQuestions = [
      {
        id: "q1",
        q: "What is the capital of Kenya?",
        opts: ["Nairobi", "Mombasa", "Kisumu", "Nakuru"],
        correct: 0,
      },
      {
        id: "q2",
        q: "Which company developed the iPhone?",
        opts: ["Samsung", "Apple", "Huawei", "Xiaomi"],
        correct: 1,
      },
      {
        id: "q3",
        q: "What is 2 + 2?",
        opts: ["3", "4", "5", "6"],
        correct: 1,
      },
      {
        id: "q4",
        q: "Which planet is known as the Red Planet?",
        opts: ["Earth", "Mars", "Jupiter", "Venus"],
        correct: 1,
      },
      {
        id: "q5",
        q: "What is the largest ocean on Earth?",
        opts: [
          "Atlantic Ocean",
          "Indian Ocean",
          "Arctic Ocean",
          "Pacific Ocean",
        ],
        correct: 3,
      },
      {
        id: "q6",
        q: "Who painted the Mona Lisa?",
        opts: [
          "Vincent van Gogh",
          "Pablo Picasso",
          "Leonardo da Vinci",
          "Claude Monet",
        ],
        correct: 2,
      },
      {
        id: "q7",
        q: "What is the chemical symbol for water?",
        opts: ["O2", "H2O", "CO2", "NaCl"],
        correct: 1,
      },
      {
        id: "q8",
        q: "Which animal is known as the 'King of the Jungle'?",
        opts: ["Tiger", "Lion", "Elephant", "Bear"],
        correct: 1,
      },
      {
        id: "q9",
        q: "How many continents are there?",
        opts: ["5", "6", "7", "8"],
        correct: 2,
      },
      {
        id: "q10",
        q: "What is the hardest natural substance on Earth?",
        opts: ["Gold", "Iron", "Diamond", "Platinum"],
        correct: 2,
      },
      {
        id: "q11",
        q: "Which country is famous for the Eiffel Tower?",
        opts: ["Italy", "Germany", "France", "Spain"],
        correct: 2,
      },
      {
        id: "q12",
        q: "What is the main ingredient in guacamole?",
        opts: ["Tomato", "Onion", "Avocado", "Lime"],
        correct: 2,
      },
      {
        id: "q13",
        q: "Which gas do plants absorb from the atmosphere?",
        opts: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
        correct: 2,
      },
      {
        id: "q14",
        q: "What is the currency of Japan?",
        opts: ["Yuan", "Won", "Yen", "Dollar"],
        correct: 2,
      },
      {
        id: "q15",
        q: "Who wrote 'Romeo and Juliet'?",
        opts: [
          "Charles Dickens",
          "William Shakespeare",
          "Jane Austen",
          "Mark Twain",
        ],
        correct: 1,
      },
      {
        id: "q16",
        q: "What is the largest mammal in the world?",
        opts: ["Elephant", "Blue Whale", "Giraffe", "Polar Bear"],
        correct: 1,
      },
      {
        id: "q17",
        q: "Which sport is known as the 'beautiful game'?",
        opts: ["Basketball", "Soccer", "Tennis", "Baseball"],
        correct: 1,
      },
      {
        id: "q18",
        q: "What is the chemical symbol for gold?",
        opts: ["Ag", "Au", "Fe", "Pb"],
        correct: 1,
      },
      {
        id: "q19",
        q: "How many days are in a leap year?",
        opts: ["365", "366", "360", "364"],
        correct: 1,
      },
      {
        id: "q20",
        q: "Which famous scientist developed the theory of relativity?",
        opts: [
          "Isaac Newton",
          "Galileo Galilei",
          "Albert Einstein",
          "Stephen Hawking",
        ],
        correct: 2,
      },
    ].map((q) => ({ ...q, date: today }));

    db.data.questions.push(...newQuestions);
    db.write();
    dailyQuestions = newQuestions;
  }
  return dailyQuestions;
}

// --- Middleware for Authentication ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401); // No token

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Invalid token
    req.user = user;
    next();
  });
};

const authorizeAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// --- API Endpoints ---

// Signup
app.post("/api/signup", async (req, res) => {
  const { name, email, username, password, referredBy } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (db.data.users.find((u) => u.email === email)) {
    return res.status(409).json({ message: "Email already registered" });
  }
  if (db.data.users.find((u) => u.username === username)) {
    return res.status(409).json({ message: "Username already taken" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: Date.now().toString(),
    name,
    email,
    username,
    password: hashedPassword,
    package: "standard",
    balance: 0,
    totalEarned: 0,
    surveysAnswered: 0,
    joinDate: new Date().toISOString(),
    referralCode: generateReferralCode(),
    referrals: 0,
    isAdmin: false,
    verified: false, // Requires admin verification
    surveyHistory: {},
    transactions: [],
    notifications: [],
  };

  db.data.users.push(newUser);
  await db.write();

  // Handle referral bonus
  if (referredBy) {
    const referrer = db.data.users.find((u) => u.referralCode === referredBy);
    if (referrer) {
      referrer.referrals = (referrer.referrals || 0) + 1;
      // Check for referral bonus (20 Ksh per 10 referrals)
      if (referrer.referrals % 10 === 0) {
        const bonus = 20;
        referrer.balance = (referrer.balance || 0) + bonus;
        referrer.transactions.unshift({
          id: Date.now() + "_ref",
          type: "credit",
          amount: bonus,
          desc: `Referral bonus for 10 referrals`,
          date: new Date().toISOString(),
        });
        addNotification(
          referrer.id,
          "gold",
          "fas fa-gift",
          "Referral Bonus!",
          `You earned KSh ${bonus} for reaching ${referrer.referrals} referrals.`
        );
      }
      addNotification(
        referrer.id,
        "blue",
        "fas fa-user-plus",
        "New Referral!",
        `${username} signed up using your code.`
      );
      await db.write();
    }
  }

  // Notify admin about new user for verification
  addNotification(
    "admin001",
    "blue",
    "fas fa-user-tag",
    "New User Signup",
    `${username} (${email}) has signed up and is awaiting verification.`
  );
  await db.write();

  res.status(201).json({ message: "User registered successfully. Awaiting admin verification." });
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = db.data.users.find((u) => u.email === email);
  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  if (!user.verified && !user.isAdmin) {
    return res.status(403).json({ message: "Account not yet verified by admin." });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, isAdmin: user.isAdmin },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  res.json({ token, user: { id: user.id, username: user.username, isAdmin: user.isAdmin, name: user.name, email: user.email, package: user.package, verified: user.verified } });
});

// Admin Login
app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;

  const adminUser = db.data.users.find(
    (u) => u.username === username && u.isAdmin
  );
  if (!adminUser) {
    return res.status(400).json({ message: "Invalid admin credentials" });
  }

  const isMatch = await bcrypt.compare(password, adminUser.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Invalid admin credentials" });
  }

  const token = jwt.sign(
    { id: adminUser.id, username: adminUser.username, isAdmin: true },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  res.json({ token, user: { id: adminUser.id, username: adminUser.username, isAdmin: true, name: adminUser.name, email: adminUser.email } });
});

// Get User Data (Protected)
app.get("/api/user/:id", authenticateToken, (req, res) => {
  if (req.user.id !== req.params.id && !req.user.isAdmin) {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  const user = db.data.users.find((u) => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  // Exclude sensitive data like password hash
  const { password, ...userData } = user;
  res.json(userData);
});

// --- Survey Endpoints ---

// Get daily questions
app.get("/api/surveys/daily", authenticateToken, (req, res) => {
  const questions = getDailyQuestions();
  res.json(questions);
});

// Submit answer
app.post("/api/surveys/submit", authenticateToken, async (req, res) => {
  const { questionIndex, chosenOptionIndex } = req.body;
  const userId = req.user.id;

  const user = db.data.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const today = new Date().toDateString();
  if (!user.surveyHistory[today]) {
    user.surveyHistory[today] = {
      answered: 0,
      correct: 0,
      earned: 0,
      answers: {},
    };
  }

  const dailyQuestions = getDailyQuestions();
  const question = dailyQuestions[questionIndex];

  if (!question) {
    return res.status(400).json({ message: "Question not found" });
  }

  if (user.surveyHistory[today].answers[questionIndex] !== undefined) {
    return res.status(400).json({ message: "Question already answered today" });
  }

  const isCorrect = chosenOptionIndex === question.correct;
  let reward = 0;
  if (isCorrect) {
    if (user.package === "vip") reward = 12;
    else if (user.package === "premium") reward = 8;
    else reward = 5;

    user.balance = (user.balance || 0) + reward;
    user.totalEarned = (user.totalEarned || 0) + reward;
    user.surveyHistory[today].correct++;
    user.transactions.unshift({
      id: Date.now() + "_survey",
      type: "reward",
      amount: reward,
      desc: `Survey correct answer (Q${questionIndex + 1})`,
      date: new Date().toISOString(),
    });
    addNotification(
      userId,
      "gold",
      "fas fa-coins",
      "Survey Reward!",
      `You earned KSh ${reward} for a correct answer.`
    );
  }

  user.surveyHistory[today].answered++;
  user.surveyHistory[today].earned += reward;
  user.surveyHistory[today].answers[questionIndex] = chosenOptionIndex;
  user.surveysAnswered = (user.surveysAnswered || 0) + 1;

  // Update analytics
  let analyticsEntry = db.data.analytics.find(
    (a) => a.userId === userId && a.date === today
  );
  if (analyticsEntry) {
    analyticsEntry.surveys++;
    if (isCorrect) {
      analyticsEntry.correct++;
      analyticsEntry.earned += reward;
    }
  } else {
    db.data.analytics.push({
      userId: userId,
      date: today,
      surveys: 1,
      correct: isCorrect ? 1 : 0,
      earned: reward,
    });
  }

  await db.write();
  res.json({ success: true, isCorrect, reward, newBalance: user.balance });
});

// --- Wallet Endpoints ---

// Deposit via M-Pesa
app.post("/api/wallet/deposit", authenticateToken, async (req, res) => {
  const { mpesaConfirmationMessage } = req.body;
  const userId = req.user.id;

  if (!mpesaConfirmationMessage) {
    return res.status(400).json({ message: "M-Pesa confirmation message is required." });
  }

  const pattern = new RegExp(
    `confirmed.*?ksh?\s*[\\d,]+\\.?\\d*.*?${MPESA_NUMBER}`,
    "i"
  );
  const pattern2 = new RegExp(
    `${MPESA_NUMBER}.*?ksh?\s*[\\d,]+`,
    "i"
  );

  if (!pattern.test(mpesaConfirmationMessage) && !pattern2.test(mpesaConfirmationMessage)) {
    return res.status(400).json({ message: "Invalid M-Pesa message format. Please paste the exact confirmation SMS you received after sending to 0755920815 via Send Money." });
  }

  const amtMatch = mpesaConfirmationMessage.match(/ksh?\s*([\d,]+\.?\d*)/i);
  const amount = amtMatch ? parseFloat(amtMatch[1].replace(",", "")) : 0;

  if (!amount) {
    return res.status(400).json({ message: "Could not detect amount from message." });
  }

  const user = db.data.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.balance = (user.balance || 0) + amount;
  user.transactions.unshift({
    id: Date.now() + "_dep",
    type: "credit",
    amount: amount,
    desc: "M-Pesa Deposit",
    date: new Date().toISOString(),
  });
  addNotification(
    userId,
    "green",
    "fas fa-check-circle",
    "Deposit Confirmed!",
    `KSh ${amount} has been credited to your wallet.`
  );
  addNotification(
    "admin001",
    "blue",
    "fas fa-money-bill",
    `Deposit from ${user.username}`, // Notify admin
    `KSh ${amount} deposit confirmed from ${user.username}.`
  );

  await db.write();
  res.json({ success: true, newBalance: user.balance, message: `Deposit of KSh ${amount} confirmed.` });
});

// Request Withdrawal
app.post("/api/wallet/withdraw", authenticateToken, async (req, res) => {
  const { amount, phoneNumber } = req.body;
  const userId = req.user.id;

  if (!amount || !phoneNumber) {
    return res.status(400).json({ message: "Amount and phone number are required." });
  }
  if (amount < 1500) {
    return res.status(400).json({ message: "Minimum withdrawal is KSh 1,500." });
  }

  const user = db.data.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (amount > (user.balance || 0)) {
    return res.status(400).json({ message: "Insufficient balance." });
  }

  user.balance -= amount;
  user.transactions.unshift({
    id: Date.now() + "_wd",
    type: "debit",
    amount: amount,
    desc: `Withdrawal to ${phoneNumber}`,
    date: new Date().toISOString(),
  });
  addNotification(
    userId,
    "blue",
    "fas fa-paper-plane",
    "Withdrawal Requested",
    `KSh ${amount} withdrawal to ${phoneNumber} is being processed.`
  );
  addNotification(
    "admin001",
    "blue",
    "fas fa-money-bill-transfer",
    `Withdrawal request: ${user.username}`, // Notify admin
    `KSh ${amount} to ${phoneNumber} from ${user.username}.`
  );

  await db.write();
  res.json({ success: true, newBalance: user.balance, message: "Withdrawal request submitted." });
});

// --- Package Endpoints ---

// Activate Package
app.post("/api/packages/activate", authenticateToken, async (req, res) => {
  const { packageName, mpesaConfirmationMessage } = req.body;
  const userId = req.user.id;

  if (!packageName || !mpesaConfirmationMessage) {
    return res.status(400).json({ message: "Package name and confirmation message are required." });
  }

  const packagePrices = { premium: 800, vip: 1200 };
  const requiredPrice = packagePrices[packageName];

  if (!requiredPrice) {
    return res.status(400).json({ message: "Invalid package name." });
  }

  const pattern = new RegExp(
    `confirmed.*?ksh?\s*[\\d,]+\\.?\\d*.*?${MPESA_NUMBER}`,
    "i"
  );
  const pattern2 = new RegExp(
    `${MPESA_NUMBER}.*?ksh?\s*[\\d,]+`,
    "i"
  );

  if (!pattern.test(mpesaConfirmationMessage) && !pattern2.test(mpesaConfirmationMessage)) {
    return res.status(400).json({ message: "Invalid M-Pesa message format." });
  }

  const amtMatch = mpesaConfirmationMessage.match(/ksh?\s*([\d,]+\.?\d*)/i);
  const amount = amtMatch ? parseFloat(amtMatch[1].replace(",", "")) : 0;

  if (!amount || amount < requiredPrice) {
    return res.status(400).json({ message: `Amount too low. Expected at least KSh ${requiredPrice}.` });
  }

  const user = db.data.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.package = packageName;
  user.transactions.unshift({
    id: Date.now() + "_pkg",
    type: "debit", // This is a payment from the user
    amount: amount,
    desc: `${packageName} package payment`,
    date: new Date().toISOString(),
  });
  addNotification(
    userId,
    "gold",
    "fas fa-crown",
    `${packageName.charAt(0).toUpperCase() + packageName.slice(1)} Package Activated!`, 
    `Your ${packageName} package is now active. Enjoy more surveys!`
  );
  addNotification(
    "admin001",
    "blue",
    "fas fa-box-open",
    `Package Purchase: ${user.username}`, // Notify admin
    `${user.username} purchased ${packageName} package for KSh ${amount}.`
  );

  await db.write();
  res.json({ success: true, newPackage: user.package, message: `${packageName} package activated!` });
});

// --- Notification Endpoints ---

// Get user notifications
app.get("/api/notifications/:userId", authenticateToken, (req, res) => {
  if (req.user.id !== req.params.userId && !req.user.isAdmin) {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  const user = db.data.users.find((u) => u.id === req.params.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json(user.notifications);
});

// Mark notification as read
app.post("/api/notifications/read/:userId/:notifId", authenticateToken, async (req, res) => {
  if (req.user.id !== req.params.userId && !req.user.isAdmin) {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  const user = db.data.users.find((u) => u.id === req.params.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  const notification = user.notifications.find((n) => n.id == req.params.notifId);
  if (notification) {
    notification.read = true;
    await db.write();
  }
  res.json({ success: true });
});

// Clear all notifications
app.post("/api/notifications/clear/:userId", authenticateToken, async (req, res) => {
  if (req.user.id !== req.params.userId && !req.user.isAdmin) {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  const user = db.data.users.find((u) => u.id === req.params.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  user.notifications = [];
  await db.write();
  res.json({ success: true });
});

// --- Admin Endpoints (Protected) ---

// Get all users (for admin panel)
app.get("/api/admin/users", authenticateToken, authorizeAdmin, (req, res) => {
  const users = db.data.users.filter((u) => !u.isAdmin);
  // Exclude sensitive data
  const safeUsers = users.map(({ password, ...user }) => user);
  res.json(safeUsers);
});

// Verify user
app.post("/api/admin/verify/:userId", authenticateToken, authorizeAdmin, async (req, res) => {
  const user = db.data.users.find((u) => u.id === req.params.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  user.verified = true;
  addNotification(
    user.id,
    "green",
    "fas fa-shield-check",
    "Account Verified!",
    "Your account has been verified by the admin. You can now access all surveys!"
  );
  await db.write();
  res.json({ success: true, message: "User verified successfully." });
});

// Send message to user
app.post("/api/admin/message/:userId", authenticateToken, authorizeAdmin, async (req, res) => {
  const { message } = req.body;
  const user = db.data.users.find((u) => u.id === req.params.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  addNotification(
    user.id,
    "purple",
    "fas fa-envelope",
    "Message from Admin",
    message
  );
  await db.write();
  res.json({ success: true, message: "Message sent to user." });
});

// Broadcast message to all users
app.post("/api/admin/broadcast", authenticateToken, authorizeAdmin, async (req, res) => {
  const { message } = req.body;
  db.data.users.filter((u) => !u.isAdmin).forEach((u) => {
    addNotification(
      u.id,
      "purple",
      "fas fa-bullhorn",
      "Admin Announcement",
      message
    );
  });
  await db.write();
  res.json({ success: true, message: "Broadcast message sent to all users." });
});

// --- Analytics Endpoints ---

// Get user analytics (for charts)
app.get("/api/analytics/:userId", authenticateToken, (req, res) => {
  if (req.user.id !== req.params.userId && !req.user.isAdmin) {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  const userAnalytics = db.data.analytics.filter(
    (a) => a.userId === req.params.userId
  );
  res.json(userAnalytics);
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
