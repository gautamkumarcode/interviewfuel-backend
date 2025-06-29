# Interview Prep Backend API

A comprehensive backend API for an interview preparation platform built with Node.js, Express, and MongoDB.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Question Management**: CRUD operations for interview questions with categories
- **Practice Sessions**: Timed practice sessions with progress tracking
- **Analytics**: Performance analytics and progress insights
- **Achievement System**: Gamification with badges and rewards
- **User Profiles**: Complete user management with stats and preferences
- **Security**: Rate limiting, input validation, and data sanitization

## 📦 Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd backend
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

4. **Start MongoDB**
   \`\`\`bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:6.0
   
   # Or use MongoDB Atlas cloud database
   \`\`\`

5. **Seed the database**
   \`\`\`bash
   npm run seed
   \`\`\`

6. **Start the server**
   \`\`\`bash
   # Development
   npm run dev
   
   # Production
   npm start
   \`\`\`

## 🔧 Environment Variables

\`\`\`env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/interview-prep
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
\`\`\`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user
- `PUT /api/auth/change-password` - Change password

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Questions
- `GET /api/questions` - Get questions with filtering/pagination
- `GET /api/questions/:id` - Get single question
- `POST /api/questions` - Create question (auth required)
- `PUT /api/questions/:id` - Update question (auth required)
- `DELETE /api/questions/:id` - Delete question (auth required)
- `POST /api/questions/:id/like` - Like/unlike question

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:slug` - Get category by slug
- `POST /api/categories` - Create category (admin only)

### Practice Sessions
- `POST /api/practice/sessions` - Create practice session
- `GET /api/practice/sessions` - Get user's sessions
- `GET /api/practice/sessions/:id` - Get specific session
- `PUT /api/practice/sessions/:id/answer` - Submit answer
- `PUT /api/practice/sessions/:id/complete` - Complete session

### Analytics
- `GET /api/analytics/dashboard` - Get user analytics
- `GET /api/analytics/leaderboard` - Get leaderboard

### Achievements
- `GET /api/achievements` - Get all achievements
- `POST /api/achievements/check` - Check user achievements

## 🗄️ Database Models

### User
- Personal information and authentication
- Statistics and preferences
- Achievement tracking
- Social links and profile data

### Question
- Question content and metadata
- Solutions and hints
- Company frequency data
- View/like statistics

### Category
- Hierarchical category structure
- Question counts and statistics
- Visual styling (icons, colors)

### Practice Session
- Session configuration and settings
- Question answers and timing
- Results and performance metrics

### Achievement
- Achievement criteria and rewards
- Rarity and categorization
- Progress tracking

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Comprehensive request validation
- **Data Sanitization**: MongoDB injection prevention
- **XSS Protection**: Cross-site scripting prevention
- **CORS Configuration**: Proper cross-origin setup

## 🧪 Testing

\`\`\`bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
\`\`\`

## 📈 Performance

- **Database Indexing**: Optimized queries with proper indexes
- **Pagination**: Efficient data loading
- **Caching**: Ready for Redis integration
- **Compression**: Response compression enabled

## 🚀 Deployment

### Using PM2
\`\`\`bash
npm install -g pm2
pm2 start server.js --name "interview-api"
\`\`\`

### Using Docker
\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
\`\`\`

## 📝 API Response Format

\`\`\`json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
\`\`\`

Error responses:
\`\`\`json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Validation errors if applicable
  ]
}
\`\`\`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
