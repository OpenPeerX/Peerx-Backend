# Learning Leaderboard Implementation

## Overview
The Learning Leaderboard system tracks and ranks users based on their educational progress, tutorial completions, quiz scores, and learning engagement. It integrates with the existing Tutorial and Rewards modules to provide a comprehensive gamified learning experience.

## Features

### Core Functionality
- **User Ranking**: Ranks users based on total points earned from learning activities
- **Tutorial Tracking**: Tracks tutorial completions using existing `TutorialProgress` entity
- **Quiz Score Integration**: Records and averages quiz scores across tutorials
- **Learning Levels**: Progressive level system (Beginner → Intermediate → Advanced → Expert → Master)
- **Streak System**: Daily activity tracking with streak bonuses
- **Badge Integration**: Automatic badge awards through Rewards module

### Points System
| Activity | Points |
|----------|--------|
| Tutorial Completion | 100 |
| Quiz Score (per point) | 0.5 |
| Module Completion Bonus | 50 |
| Daily Streak Bonus | 10 |
| Badge Earned | 25 |

### Learning Levels
| Level | Points Required |
|-------|----------------|
| BEGINNER | 0 - 499 |
| INTERMEDIATE | 500 - 1,499 |
| ADVANCED | 1,500 - 2,999 |
| EXPERT | 3,000 - 4,999 |
| MASTER | 5,000+ |

## Database Schema

### LearningProfile Entity
```typescript
{
  id: string (uuid)
  userId: number (unique)
  totalPoints: number
  tutorialsCompleted: number
  totalQuizScore: number
  averageQuizScore: number
  currentStreak: number
  longestStreak: number
  lastActivityDate: Date
  consecutiveDays: number
  completedModules: string[]
  moduleScores: Record<string, number>
  earnedBadges: string[]
  learningLevel: LearningLevel
  createdAt: Date
  updatedAt: Date
  lastCalculatedAt: Date
}
```

### TutorialProgress Updates
Added field:
- `quizScore?: number` - Stores the quiz score for each tutorial

## API Endpoints

### Leaderboard Endpoints

#### GET `/learning/leaderboard`
Get global leaderboard with optional filters.

**Query Parameters:**
- `limit` (optional, default: 100) - Number of entries to return
- `offset` (optional, default: 0) - Pagination offset
- `level` (optional) - Filter by learning level
- `timeFrame` (optional) - 'all', 'week', 'month', or 'year'

**Response:**
```json
{
  "entries": [
    {
      "rank": 1,
      "userId": 123,
      "username": "User_123",
      "totalPoints": 2500,
      "tutorialsCompleted": 15,
      "averageQuizScore": 85,
      "learningLevel": "ADVANCED",
      "currentStreak": 7,
      "earnedBadges": ["First Steps", "Week Warrior"]
    }
  ],
  "totalUsers": 500,
  "timeFrame": "all",
  "lastUpdated": "2026-03-26T10:00:00Z"
}
```

#### GET `/learning/leaderboard/top`
Get top learners for a specific period.

**Query Parameters:**
- `limit` (optional, default: 10)
- `timeFrame` (optional, default: 'week') - 'week', 'month', or 'year'

#### GET `/learning/profile`
Get current user's learning profile with rank and percentile.

**Response:**
```json
{
  "userId": 123,
  "username": "User_123",
  "totalPoints": 2500,
  "tutorialsCompleted": 15,
  "totalQuizScore": 1275,
  "averageQuizScore": 85,
  "currentStreak": 7,
  "longestStreak": 21,
  "learningLevel": "ADVANCED",
  "completedModules": ["tutorial-1", "tutorial-2"],
  "moduleScores": {
    "tutorial-1": 90,
    "tutorial-2": 85
  },
  "earnedBadges": ["First Steps", "Week Warrior"],
  "rank": 42,
  "percentile": 91.6
}
```

#### GET `/learning/profile/:userId`
Get specific user's learning profile.

#### GET `/learning/rank`
Get current user's rank and percentile.

### Progress Tracking Endpoints

#### POST `/learning/tutorial/complete`
Record tutorial completion with optional quiz score.

**Body:**
```json
{
  "tutorialId": "tutorial-123",
  "quizScore": 95,
  "completionTime": "2026-03-26T10:00:00Z"
}
```

#### PATCH `/learning/tutorial/progress`
Update tutorial progress.

**Body:**
```json
{
  "tutorialId": "tutorial-123",
  "step": 5,
  "quizScore": 90
}
```

### Gamification Endpoints

#### POST `/learning/badge/:badgeName`
Award badge to current user (used by Rewards module).

### Admin Endpoints

#### POST `/learning/admin/recalculate`
Recalculate all user profiles from scratch.

#### DELETE `/learning/admin/reset`
Reset all learning profiles (use with caution).

## Integration Points

### Tutorial Module Integration
The `TutorialService.updateProgress()` method automatically updates the learning leaderboard when tutorial progress is made:

```typescript
async updateProgress(userId: string, tutorialId: string, step: number, quizScore?: number) {
  // ... existing progress logic
  
  // Update leaderboard
  await this.leaderboardService.updateTutorialProgress(
    numericUserId,
    tutorialId,
    step,
    quizScore,
  );
}
```

### Rewards Module Integration
Learning achievements are integrated with the badge system:

**Learning Badges:**
- **First Steps** - Complete 1 tutorial
- **Dedicated Learner** - Complete 5 tutorials
- **Knowledge Seeker** - Complete 10 tutorials
- **Week Warrior** - Maintain 7-day streak
- **Month Master** - Maintain 30-day streak
- **Intermediate** - Reach Intermediate level
- **Advanced** - Reach Advanced level
- **Expert** - Reach Expert level
- **Master** - Reach Master level

## Usage Examples

### Example 1: Complete a Tutorial with Quiz
```typescript
// PATCH /tutorial/:id/progress
{
  "step": 10,  // Assuming 10 steps in tutorial
  "quizScore": 95
}

// This automatically:
// 1. Marks tutorial as completed
// 2. Stores quiz score
// 3. Awards 100 points (completion) + 50 points (bonus) + 47 points (quiz)
// 4. Updates streak if applicable
// 5. Recalculates learning level
// 6. Checks for badge eligibility
```

### Example 2: Get Leaderboard
```typescript
// GET /learning/leaderboard?limit=10&timeFrame=month
const response = await fetch('/learning/leaderboard?limit=10&timeFrame=month');
const data = await response.json();
console.log(data.entries); // Top 10 learners this month
```

### Example 3: Get User Profile
```typescript
// GET /learning/profile
const response = await fetch('/learning/profile');
const profile = await response.json();
console.log(`Rank: #${profile.rank}, Points: ${profile.totalPoints}`);
```

## Streak Calculation Logic

The streak system tracks daily learning activity:

```typescript
updateStreak(profile: LearningProfile): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (!profile.lastActivityDate) {
    profile.currentStreak = 1;
  } else {
    const lastActivity = new Date(profile.lastActivityDate);
    const daysDiff = (today - lastActivity) / (1000 * 60 * 60 * 24);
    
    if (daysDiff === 1) {
      profile.currentStreak += 1;
      profile.totalPoints += 10; // Streak bonus
    } else if (daysDiff > 1) {
      profile.currentStreak = 1; // Reset streak
    }
  }
  
  profile.longestStreak = Math.max(profile.longestStreak, profile.currentStreak);
}
```

## Migration

Run the migration to create the `learning_profiles` table:

```bash
npm run typeorm -- migration:run
```

The migration will:
1. Create `learning_profiles` table with all required columns
2. Add indexes on `user_id` and `total_points` for performance
3. Add `quiz_score` column to `tutorial_progress` table

## Performance Considerations

### Indexes
- `IDX_learning_profiles_user_id` - Fast user lookup
- `IDX_learning_profiles_total_points` - Fast leaderboard queries

### Caching
For high-traffic applications, consider caching leaderboard results:
```typescript
// Cache leaderboard for 5 minutes
@CacheKey('leaderboard:global')
@CacheTTL(300)
async getLeaderboard() { ... }
```

## Testing

### Unit Tests
Test the service methods:
```typescript
describe('LearningLeaderboardService', () => {
  it('should calculate points correctly', async () => {
    const profile = await service.updateTutorialProgress(
      1,
      'tutorial-1',
      10,
      95
    );
    expect(profile.totalPoints).toBe(197); // 100 + 50 + 47
  });
});
```

### Integration Tests
Test the full flow:
```typescript
it('should update leaderboard on tutorial completion', async () => {
  await request(app.getHttpServer())
    .patch('/tutorial/123/progress')
    .send({ step: 10, quizScore: 90 })
    .expect(200);
    
  const profile = await service.getUserProfile(1);
  expect(profile.tutorialsCompleted).toBe(1);
});
```

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live leaderboard updates
2. **Team Competitions**: Group users into teams for collaborative learning
3. **Seasonal Leaderboards**: Reset rankings periodically for fresh competition
4. **Achievement Tiers**: Bronze/Silver/Gold badge variants
5. **Learning Paths**: Curated tutorial sequences with bonus rewards
6. **Social Features**: Follow other learners, activity feeds
7. **Analytics Dashboard**: Learning trends and insights

## Acceptance Criteria Met

✅ **Learning progress tracked accurately** - Uses `TutorialProgress.isCompleted` and adds `quizScore` field

✅ **Points system implemented** - Comprehensive points for completions, quizzes, streaks, and badges

✅ **Leaderboard reflects current standings** - Real-time ranking with proper sorting by points

✅ **Integration with Tutorial completion events** - Automatic updates via `TutorialService.updateProgress()`

✅ **User engagement metrics included** - Streaks, levels, badges, and activity tracking

✅ **Gamification elements** - Full integration with Rewards module for learning-based badges

## Support

For issues or questions:
- Check the entity files in `src/tutorial/entities/`
- Review the service implementation in `src/tutorial/services/learning-leaderboard.service.ts`
- See migration file `src/database/migrations/1737600000000-CreateLearningLeaderboard.ts`
