import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAdmin, RequireMember } from "./auth/RequireMember";
import PublicLayout from "./components/PublicLayout";
import AppLayout from "./components/AppLayout";
import Home from "./pages/public/Home";
import Gallery from "./pages/public/Gallery";
import AlbumView from "./pages/public/AlbumView";
import Login from "./pages/public/Login";
import SetPassword from "./pages/public/SetPassword";
import Feed from "./pages/app/Feed";
import People from "./pages/app/People";
import ProfilePage from "./pages/app/ProfilePage";
import Messages from "./pages/app/Messages";
import Albums from "./pages/app/Albums";
import AlbumManage from "./pages/app/AlbumManage";
import ImportFacebook from "./pages/app/ImportFacebook";
import Invite from "./pages/app/Invite";
import Admin from "./pages/app/Admin";
import Appearance from "./pages/app/Appearance";
import SiteSettings from "./pages/app/SiteSettings";
import { SiteProvider } from "./lib/site";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SiteProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="gallery/:id" element={<AlbumView />} />
              <Route path="login" element={<Login />} />
              <Route path="setup" element={<SetPassword mode="setup" />} />
              <Route path="welcome" element={<SetPassword mode="welcome" />} />
              <Route path="reset-password" element={<SetPassword mode="reset" />} />
            </Route>
            <Route path="app" element={<RequireMember />}>
              <Route element={<AppLayout />}>
                <Route index element={<Feed />} />
                <Route path="people" element={<People />} />
                <Route path="people/:id" element={<ProfilePage />} />
                <Route path="messages" element={<Messages />} />
                <Route path="messages/:id" element={<Messages />} />
                <Route path="albums" element={<Albums />} />
                <Route path="albums/:id" element={<AlbumManage />} />
                <Route path="import/facebook" element={<ImportFacebook />} />
                <Route path="invite" element={<Invite />} />
                <Route path="settings" element={<Appearance />} />
                <Route element={<RequireAdmin />}>
                  <Route path="admin" element={<Admin />} />
                  <Route path="admin/site" element={<SiteSettings />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SiteProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
