import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Ledger from "./pages/Ledger";
import Portfolio from "./pages/Portfolio";
import Leaderboard from "./pages/Leaderboard";
import NewsFeed from "./pages/NewsFeed";
import Sentiment from "./pages/Sentiment";
import AdminSQL from "./pages/AdminSQL";
import AdminDB from "./pages/AdminDB";
import Casino from "./pages/Casino";
import Blackjack from "./pages/Blackjack";
import Mines from "./pages/Mines";
import Crash from "./pages/Crash";
import Roulette from "./pages/Roulette";
import Poker from "./pages/VideoPoker";
import CasinoShop from "./pages/CasinoShop";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/register"} component={Register} />
      <Route path={"/ledger"} component={Ledger} />
      <Route path={"/portfolio"} component={Portfolio} />
      <Route path={"/leaderboard"} component={Leaderboard} />
      <Route path={"/news"} component={NewsFeed} />
      <Route path={"/sentiment"} component={Sentiment} />
      <Route path={"/casino/blackjack"} component={Blackjack} />
      <Route path={"/casino/mines"} component={Mines} />
      <Route path={"/casino/crash"} component={Crash} />
      <Route path={"/casino/roulette"} component={Roulette} />
      <Route path={"/casino/poker"} component={Poker} />
      <Route path={"/casino/shop"} component={CasinoShop} />
      <Route path={"/casino"} component={Casino} />
      <Route path={"/admin/sql"} component={AdminSQL} />
      <Route path={"/admin"} component={AdminDB} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
