import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAdmin, RequireMember } from "./auth/RequireMember";
import { isConfigured } from "./lib/supabase";
import PublicLayout from "./components/PublicLayout";
import AppLayout from "./components/AppLayout";
import Home from "./pages/public/Home";
import Gallery from "./pages/public/Gallery";
import AlbumView from "./pages/public/AlbumView";
import Login from "./pages/public/Login";
import SetPassword from "./pages/public/SetPassword";
import Pending from "./pages/public/Pending";
import Feed from "./pages/app/Feed";
import People from "./pages/app/People";
import ProfilePage from "./pages/app/ProfilePage";
import Messages from "./pages/app/Messages";
import Albums from "./pages/app/Albums";
import AlbumManage from "./pages/app/AlbumManage";
import Invite from "./pages/app/Invite";
import Admin from "./pages/app/Admin";

export default function App() {
  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-lg p-12 text-center">
        <h1 className="text-xl font-semibold">Almost there</h1>
        <p className="mt-2 text-slate-600">
          Copy <code>.env.example</code> to <code>.env.local</code> and add your Supabase URL and anon key.
        </p>
      </div>
    );
  }
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="gallery/:id" element={<AlbumView />} />
            <Route path="login" element={<Login />} />
            <Route path="welcome" element={<SetPassword welcome />} />
            <Route path="reset-password" element={<SetPassword welcome={false} />} />
            <Route path="pending" element={<Pending />} />
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
              <Route path="invite" element={<Invite />} />
              <Route element={<RequireAdmin />}>
                <Route path="admin" element={<Admin />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
