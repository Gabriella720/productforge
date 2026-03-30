import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Projects from './pages/Projects';
import Blog from './pages/Blog';
import BlogDetail from './pages/BlogDetail';
import About from './pages/About';
import Admin from './pages/Admin';
import Login from './pages/Login';
import { DataProvider, useData } from './context/DataContext';

const AnalyticsTracker = () => {
  const location = useLocation();
  const { recordVisit } = useData();

  useEffect(() => {
    // Record visit on route change
    recordVisit(location.pathname);
  }, [location.pathname, recordVisit]);

  return null;
};

const ProtectedRoute = ({ children }) => {
  const { isAdmin } = useData();
  if (!isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }
  return children;
};

function AppContent() {
  return (
    <div className="min-h-screen bg-white pt-16">
      <AnalyticsTracker />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:id" element={<BlogDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin-login" element={<Login />} />
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <DataProvider>
      <Router>
        <AppContent />
      </Router>
    </DataProvider>
  );
}

export default App;
