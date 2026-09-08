// Top-level route table. Login/register are public; everything else sits behind AuthGuard,
// which redirects to /login if there's no valid session.
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
        {/* /import creates a new deck from the import; /decks/:id/import re-imports into an
            existing one — both render the same ImportPage, which branches on whether :id is present. */}
        <Route path="/import" element={<ImportPage />} />
        <Route path="/decks/:id/import" element={<ImportPage />} />
      </Route>
    </Routes>
  );
}

export default App;
