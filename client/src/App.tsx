import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import WelcomeModal from "./components/WelcomeModal";
import AppNav from "./components/AppNav";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Loader2 } from "lucide-react";

// Eager: Home + Login (critical path)
import Home from "./pages/Home";
import Login from "./pages/Login";

// Lazy: everything else
const Register = lazy(() => import("./pages/Register"));
const Ledger = lazy(() => import("./pages/Ledger"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Feed = lazy(() => import("./pages/Feed"));
const AdminSQL = lazy(() => import("./pages/AdminSQL"));
const AdminDB = lazy(() => import("./pages/AdminDB"));
const Casino = lazy(() => import("./pages/Casino"));
const Blackjack = lazy(() => import("./pages/Blackjack"));
const Mines = lazy(() => import("./pages/Mines"));
const Crash = lazy(() => import("./pages/Crash"));
const Roulette = lazy(() => import("./pages/Roulette"));
const Poker = lazy(() => import("./pages/VideoPoker"));
const CasinoShop = lazy(() => import("./pages/CasinoShop"));
const Dice = lazy(() => import("./pages/Dice"));
const Hilo = lazy(() => import("./pages/Hilo"));
const Plinko = lazy(() => import("./pages/Plinko"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Trade = lazy(() => import("./pages/Trade"));
const About = lazy(() => import("./pages/About"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/trade"} component={Trade} />
        <Route path={"/about"} component={About} />
        <Route path={"/login"} component={Login} />
        <Route path={"/register"} component={Register} />
        <Route path={"/ledger"} component={Ledger} />
        <Route path={"/portfolio"} component={Portfolio} />
        <Route path={"/leaderboard"} component={Leaderboard} />
        <Route path={"/profile/:userId"} component={UserProfile} />
        <Route path={"/feed"} component={Feed} />
        <Route path={"/news"} component={Feed} />
        <Route path={"/casino/blackjack"} component={Blackjack} />
        <Route path={"/casino/mines"} component={Mines} />
        <Route path={"/casino/crash"} component={Crash} />
        <Route path={"/casino/roulette"} component={Roulette} />
        <Route path={"/casino/poker"} component={Poker} />
        <Route path={"/casino/shop"} component={CasinoShop} />
        <Route path={"/casino/dice"} component={Dice} />
        <Route path={"/casino/hilo"} component={Hilo} />
        <Route path={"/casino/plinko"} component={Plinko} />
        <Route path={"/casino"} component={Casino} />

        <Route path={"/admin/sql"} component={AdminSQL} />
        <Route path={"/admin"} component={AdminDB} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="charcoal">
        <TooltipProvider>
          <Toaster />
          <WelcomeModal />
          <AppNav />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
