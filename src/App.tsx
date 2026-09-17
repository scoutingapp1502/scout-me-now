import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import AdminDashboard from "./pages/AdminDashboard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ResetPassword from "./pages/ResetPassword";
import AdminVideoReview from "./pages/AdminVideoReview";
import ExternalRecommend from "./pages/ExternalRecommend";
import JoinGroup from "./pages/JoinGroup";
import PublicTerms from "./pages/PublicTerms";
import PublicPrivacy from "./pages/PublicPrivacy";
import PublicCookies from "./pages/PublicCookies";
import PublicContact from "./pages/PublicContact";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/video-review" element={<AdminVideoReview />} />
            <Route path="/recommend" element={<ExternalRecommend />} />
            <Route path="/join-group/:token" element={<JoinGroup />} />
            <Route path="/terms" element={<PublicTerms />} />
            <Route path="/privacy" element={<PublicPrivacy />} />
            <Route path="/cookies" element={<PublicCookies />} />
            <Route path="/contact" element={<PublicContact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
