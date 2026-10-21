import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { differe } from './app/chargement-differe';
import { Ecran, Marque } from './components/Ecran';

// Chaque page est un morceau chargé à la demande (jamais un import statique de page ici).
const AccueilPage = differe(() => import('./features/accueil/AccueilPage'), 'AccueilPage');
const SeuilPage = differe(() => import('./features/seuil/SeuilPage'), 'SeuilPage');
const ScanPage = differe(() => import('./features/scan/ScanPage'), 'ScanPage');
const ProduitPage = differe(() => import('./features/produit/ProduitPage'), 'ProduitPage');
const IngredientsPage = differe(() => import('./features/produit/IngredientsPage'), 'IngredientsPage');
const LogoPage = differe(() => import('./features/certification/LogoPage'), 'LogoPage');
const ContributionPage = differe(() => import('./features/contribution/ContributionPage'), 'ContributionPage');
const HistoriquePage = differe(() => import('./features/historique/HistoriquePage'), 'HistoriquePage');
const AdminPage = differe(() => import('./features/admin/AdminPage'), 'AdminPage');

function Attente() {
  return (
    <Ecran barre={<Marque />}>
      <p className="muet" role="status">
        Chargement…
      </p>
    </Ecran>
  );
}

export function App() {
  return (
    <Suspense fallback={<Attente />}>
      <Routes>
        <Route path="/" element={<AccueilPage />} />
        <Route path="/seuil" element={<SeuilPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/produit/:ean" element={<ProduitPage />} />
        <Route path="/produit/:ean/ingredients" element={<IngredientsPage />} />
        <Route path="/produit/:ean/logo" element={<LogoPage />} />
        <Route path="/produit/:ean/contribution" element={<ContributionPage />} />
        <Route path="/historique" element={<HistoriquePage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route
          path="*"
          element={
            <Ecran barre={<Marque />}>
              <p>Cette page n’existe pas.</p>
            </Ecran>
          }
        />
      </Routes>
    </Suspense>
  );
}
