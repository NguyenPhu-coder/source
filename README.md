# 🎓 Learn Platform with Multi-Agent AI System

## 🌟 Giới thiệu

Hệ thống học tập thông minh tích hợp 19 AI agents để cung cấp trải nghiệm học tập được cá nhân hóa, phân tích nâng cao, và quản lý nội dung tự động.

### ✨ Tính năng chính

- 🎯 **Personalized Learning**: Đề xuất khóa học và lộ trình học tập được cá nhân hóa
- ✅ **Content Quality**: Kiểm tra chất lượng nội dung tự động (toxicity, plagiarism, bias)
- 📊 **Advanced Analytics**: Phân tích engagement, dự đoán dropout, tracking chi tiết
- 🤖 **Auto Quiz Generation**: Tạo quiz tự động từ nội dung bài học
- 🧠 **Knowledge Graph**: Hiển thị mối quan hệ giữa các khóa học và prerequisite
- 🌍 **Auto Translation**: Dịch nội dung khóa học sang nhiều ngôn ngữ
- 🎨 **AI Visual Generation**: Tạo thumbnail và hình ảnh minh họa tự động
- 📈 **Real-time Monitoring**: Giám sát hệ thống với Prometheus và Grafana

## 🏗️ Kiến trúc Hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                    Learn Platform                            │
│                                                              │
│  Frontend (React) ←→ Backend (Node.js) ←→ MySQL Database   │
│                           ↓                                  │
│                    Event Publisher                           │
│                    Agent Service                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Kafka Events / HTTP API
┌─────────────────────────────────────────────────────────────┐
│                   Multi-Agent System                         │
│                                                              │
│  Orchestration Agent (Gateway)                              │
│           ├── Content Quality Agent                         │
│           ├── Personalization Agent                         │
│           ├── Analytics Agent                               │
│           ├── Assessment Agent                              │
│           ├── Knowledge Graph Agent                         │
│           ├── Translation Agent                             │
│           ├── Visual Generation Agent                       │
│           └── ... 12 more agents                           │
└─────────────────────────────────────────────────────────────┘
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) | Hướng dẫn setup và deployment chi tiết |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Kế hoạch tích hợp từng tính năng với code examples |
| [SUMMARY.md](SUMMARY.md) | Tổng hợp những gì đã hoàn thành |

## 🚀 Quick Start

### Prerequisites

- Docker Desktop
- Node.js 20+
- 16GB RAM (32GB recommended)
- 50GB free disk space

### Installation

```powershell
# 1. Clone repository
cd C:\Users\Windows\Downloads\locac\learn

# 2. Setup environment variables
cd learn\backend
cp .env.example .env
# Edit .env with your configuration

# 3. Start all services
cd ..\..
docker-compose -f docker-compose.unified.yml up -d

# 4. Wait for services to be healthy (2-3 minutes)
docker ps

# 5. Access the platform
# Frontend: http://localhost:5173
# Backend: http://localhost:3000/api
# Grafana: http://localhost:3001
```

### Verify Installation

```powershell
# Check backend health
curl http://localhost:3000/api/health

# Check agent system health
curl http://localhost:3000/api/agents/health

# View logs
docker-compose -f docker-compose.unified.yml logs -f learn-backend
```

## 🎯 Usage Examples

### Content Quality Validation

```typescript
// Validate course content before publishing
const validation = await agentService.validateContent({
  contentType: 'course',
  contentId: courseId,
  title: 'Introduction to Python',
  description: 'Learn Python programming...'
});

if (validation.success && validation.data.passed) {
  // Content is safe to publish
  await publishCourse(courseId);
}
```

### Personalized Recommendations

```typescript
// Get AI-powered course recommendations
const recommendations = await agentService.getRecommendations({
  userId: currentUser.id,
  courseHistory: [1, 2, 3],
  limit: 10
});

// Display recommendations to user
displayRecommendations(recommendations.data.recommendations);
```

### Auto Quiz Generation

```typescript
// Generate quiz from lesson content
const quiz = await agentService.generateQuiz({
  lessonId: 123,
  courseId: 45,
  content: lessonText,
  difficulty: 'intermediate',
  questionCount: 5
});

// Save generated quiz
await saveQuiz(quiz.data.questions);
```

### Analytics & Dropout Prediction

```typescript
// Get dropout risk for a student
const risk = await agentService.getDropoutRisk(userId, courseId);

if (risk.data.riskLevel === 'high') {
  // Send intervention notification
  await sendInterventionEmail(userId, risk.data.interventionSuggestions);
}
```

## 🛠️ Development

### Backend Development

```powershell
cd learn\backend
npm install
npm run dev
```

### Frontend Development

```powershell
cd learn\frontend
npm install
npm run dev
```

### Agent Development

```powershell
cd agents
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Run specific agent
cd orchestration_agent
python orchestration_agent.py
```

## 📊 Monitoring & Observability

### Grafana Dashboards
- **URL**: http://localhost:3001
- **Login**: admin / admin123
- **Dashboards**: Agent metrics, course analytics, user engagement

### Prometheus Metrics
- **URL**: http://localhost:9090
- **Metrics**: Request rate, response time, error rate

### Application Logs
```powershell
# Backend logs
docker logs learn-backend -f

# Agent logs
docker logs lyw-orchestration -f

# Kafka logs
docker logs lyw-kafka -f
```

## 🔒 Security

- JWT authentication for all protected endpoints
- Content validation to prevent malicious content
- Rate limiting on API endpoints
- CORS configuration
- SQL injection prevention
- XSS protection

## 🌍 Internationalization

Currently supports:
- 🇺🇸 English (en)
- 🇻🇳 Vietnamese (vi)

Coming soon:
- 🇯🇵 Japanese (ja)
- 🇰🇷 Korean (ko)
- 🇪🇸 Spanish (es)

## 🧪 Testing

### API Testing

```bash
# Test content validation
curl -X POST http://localhost:3000/api/agents/validate-content \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"course","contentId":1,"title":"Test"}'

# Test recommendations
curl http://localhost:3000/api/agents/recommendations \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test analytics
curl http://localhost:3000/api/agents/analytics/engagement \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Load Testing

```powershell
# Using Apache Bench
ab -n 1000 -c 10 http://localhost:3000/api/courses

# Using k6
k6 run tests/load-test.js
```

## 📈 Performance

### Optimization Strategies
- Redis caching for agent responses
- Database query optimization
- CDN for static assets
- Lazy loading for heavy components
- Background jobs for slow operations

### Benchmarks
- API response time: < 200ms (p95)
- Agent response time: < 2s (p95)
- Page load time: < 3s
- Time to Interactive: < 5s

## 🐛 Troubleshooting

### Common Issues

**Issue**: Docker containers not starting
```powershell
# Solution: Check Docker Desktop is running
docker ps
docker-compose -f docker-compose.unified.yml restart
```

**Issue**: Kafka connection failed
```powershell
# Solution: Wait for Kafka to be ready
docker logs lyw-kafka
docker exec lyw-kafka kafka-topics --bootstrap-server localhost:9092 --list
```

**Issue**: Agent returns timeout
```powershell
# Solution: Increase timeout or check agent logs
docker logs lyw-orchestration
# Adjust AGENT_TIMEOUT in .env
```

**Issue**: Database sync not working
```powershell
# Solution: Manually run sync script
docker exec lyw-postgres psql -U learnuser -d learndb < agents/shared/postgres_schema.sql
```

## 🤝 Contributing

### Development Workflow
1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Style
- **Backend**: ESLint + Prettier
- **Frontend**: ESLint + Prettier
- **Python**: Black + Flake8

## 📞 Support

### Resources
- 📖 [Integration Guide](INTEGRATION_GUIDE.md)
- 📋 [Implementation Plan](IMPLEMENTATION_PLAN.md)
- 📊 [Summary](SUMMARY.md)

### Contact
- **Email**: support@learnplatform.com
- **Issues**: GitHub Issues
- **Discord**: Join our community

## 🗺️ Roadmap

### Q1 2026
- ✅ Multi-agent integration
- ✅ Content quality validation
- ✅ Personalized recommendations
- ✅ Analytics dashboard
- 🔄 Mobile app (React Native)
- 🔄 Advanced search (Elasticsearch)

### Q2 2026
- Real-time collaboration
- WebSocket integration
- A/B testing framework
- Advanced gamification
- Payment system upgrade

### Q3 2026
- Machine learning personalization
- Advanced content generation
- Blockchain certificates
- AR/VR learning experiences

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- FastAPI for agent framework
- Express.js for backend
- React for frontend
- Docker for containerization
- Kafka for event streaming
- Neo4j for knowledge graphs

---

**Built with ❤️ for better learning experiences**

**Last Updated**: December 16, 2025
**Version**: 2.0.0 (Multi-Agent Integration)
#   s o u r c e  
 