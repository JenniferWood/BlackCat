import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { DataCacheProvider } from './contexts/DataCache';
import { TabBar } from './components/TabBar';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import GalleryPage from './pages/GalleryPage';
import DetailPage from './pages/DetailPage';
import ComposePage from './pages/ComposePage';
import ResultPage from './pages/ResultPage';

function TabBarLayout() {
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DataCacheProvider>
        <Routes>
        <Route element={<TabBarLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/compose" element={<ComposePage />} />
        </Route>
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/detail/:id" element={<DetailPage />} />
        <Route path="/result" element={<ResultPage />} />
      </Routes>
      </DataCacheProvider>
    </BrowserRouter>
  );
}
