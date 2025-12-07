import { Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from '../pages/HomePage/HomePage'
import { AboutPage } from '../pages/AboutPage/AboutPage'
import { NotFoundPage } from '../pages/NotFoundPage/NotFoundPage'
import './App.css'

export default function App() {
  return (
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
  )
}
