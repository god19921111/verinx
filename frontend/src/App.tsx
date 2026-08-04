import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NetworkStatus } from './components/NetworkStatus'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ProfilePage } from './pages/ProfilePage'
import { SinglePracticePage } from './pages/SinglePracticePage'
import { FullPracticePage } from './pages/FullPracticePage'
import { HistoryPage } from './pages/HistoryPage'
import { ReportPage } from './pages/ReportPage'
import { MembershipPage } from './pages/MembershipPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { WeaknessPage } from './pages/WeaknessPage'
import { ProgressPage } from './pages/ProgressPage'
import { CheckinPage } from './pages/CheckinPage'
import { ChallengePage } from './pages/ChallengePage'
import { AchievementsPage } from './pages/AchievementsPage'

function App() {
  return (
    <BrowserRouter>
      <NetworkStatus />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/practice/single" element={<SinglePracticePage />} />
          <Route path="/practice/full" element={<FullPracticePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/report/:id" element={<ReportPage />} />
          <Route path="/membership" element={<MembershipPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/weakness" element={<WeaknessPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="/challenge" element={<ChallengePage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
