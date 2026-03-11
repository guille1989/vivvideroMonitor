import { Routes, Route } from 'react-router-dom';
import { Toaster } from './components/ui/Toaster';
import { SocketProvider } from './hooks/useSocket';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import Layout from './components/Layout';

const PLACE_ID = 'ChIJgdfWKLaaP44R59EHzMeJdX0';

export default function App() {
  return (
    <SocketProvider>
      <Toaster>
        <Layout placeId={PLACE_ID}>
          <Routes>
            <Route path="/" element={<DashboardPage placeId={PLACE_ID} />} />
            <Route path="/analytics" element={<AnalyticsPage placeId={PLACE_ID} />} />
          </Routes>
        </Layout>
      </Toaster>
    </SocketProvider>
  );
}
