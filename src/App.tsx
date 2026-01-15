import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Demo from "./pages/Demo";
import Auth from "./pages/Auth";
import CreatePool from "./pages/CreatePool";
import MyPools from "./pages/MyPools";
import Pool from "./pages/Pool";
import JoinPool from "./pages/JoinPool";
import NotFound from "./pages/NotFound";
import AdminRosters from "./pages/admin/Rosters";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/join" element={<JoinPool />} />
            <Route path="/join/:code" element={<JoinPool />} />
            <Route path="/create-pool" element={<ProtectedRoute><CreatePool /></ProtectedRoute>} />
            <Route path="/my-pools" element={<ProtectedRoute><MyPools /></ProtectedRoute>} />
            <Route path="/pool/:poolId" element={<Pool />} />
            {/* Admin routes */}
            <Route path="/admin/rosters" element={<ProtectedRoute><AdminRosters /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
