import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Chatbot from "./pages/Chatbot";
import Calculadora from "./pages/Calculadora";
import Mercado from "./pages/Mercado";
import MisVentas from "./pages/MisVentas";
import Alertas from "./pages/Alertas";
import Documentos from "./pages/Documentos";
import Noticias from "./pages/Noticias";
import Perfil from "./pages/Perfil";
import BaseConocimiento from "./pages/BaseConocimiento";
import Login from "./pages/Login";
import DashboardLayout from "./components/DashboardLayout";

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        {() => (
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/chatbot">
        {() => (
          <DashboardLayout>
            <Chatbot />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/calculadora">
        {() => (
          <DashboardLayout>
            <Calculadora />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/mercado">
        {() => (
          <DashboardLayout>
            <Mercado />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/mis-ventas">
        {() => (
          <DashboardLayout>
            <MisVentas />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/alertas">
        {() => (
          <DashboardLayout>
            <Alertas />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/documentos">
        {() => (
          <DashboardLayout>
            <Documentos />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/noticias">
        {() => (
          <DashboardLayout>
            <Noticias />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/perfil">
        {() => (
          <DashboardLayout>
            <Perfil />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/base-conocimiento">
        {() => (
          <DashboardLayout>
            <BaseConocimiento />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
