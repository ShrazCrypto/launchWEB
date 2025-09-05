import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ContractPage from './components/ContractPage'
import Navigation from './components/Navigation'
import TestChart from './components/TestChart'

function HomePage() {
  return (
    <div className="app">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Welcome to <span className="highlight">Creatok</span>
          </h1>
          <p className="hero-subtitle">
            Creative solutions for the modern world. We bring your ideas to life with innovative design and cutting-edge technology.
          </p>
          <div className="hero-buttons">
            <button className="btn btn-primary">Get Started</button>
            <button className="btn btn-secondary">Learn More</button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-card card-1">
            <div className="card-content">
              <h3>Design</h3>
              <p>Beautiful & functional</p>
            </div>
          </div>
          <div className="floating-card card-2">
            <div className="card-content">
              <h3>Innovation</h3>
              <p>Cutting-edge solutions</p>
            </div>
          </div>
          <div className="floating-card card-3">
            <div className="card-content">
              <h3>Quality</h3>
              <p>Excellence guaranteed</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Navigation />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/token/:contractAddress" element={<ContractPage />} />
        <Route path="/test" element={<TestChart />} />
      </Routes>
    </Router>
  )
}

export default App
