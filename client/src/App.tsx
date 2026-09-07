import { Route, Routes } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard";
import { LoginPage } from "./routes/LoginPage";
import { RegisterPage } from "./routes/RegisterPage";
import { DashboardPage } from "./routes/DashboardPage";
import { DeckEditorPage } from "./routes/DeckEditorPage";
import { ImportPage } from "./routes/ImportPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<AuthGuard />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/decks/:id" element={<DeckEditorPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/decks/:id/import" element={<ImportPage />} />
      </Route>
    </Routes>
  );
}

export default App;
