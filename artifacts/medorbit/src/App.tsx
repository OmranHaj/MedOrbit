import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import Dashboard from '@/pages/dashboard';
import Doctors from '@/pages/doctors';
import DoctorNew from '@/pages/doctor-new';
import DoctorEdit from '@/pages/doctor-edit';
import DoctorProfile from '@/pages/doctor-profile';
import Products from '@/pages/products';
import Visits from '@/pages/visits';
import VisitNew from '@/pages/visit-new';
import SmartRoute from '@/pages/smart-route';
import ClinicDemo from '@/pages/clinic-demo';
import PharmacyInsights from '@/pages/pharmacy-insights';
import Handover from '@/pages/handover';
import MyRegion from '@/pages/my-region';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnMount: true, refetchOnWindowFocus: true, retry: 1 } },
});

function Router() {
  return (
    <Switch>
      <Route path="/clinic-demo" component={ClinicDemo} />
      <Route><ShellRoutes /></Route>
    </Switch>
  );
}

function ShellRoutes() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/doctors" component={Doctors} />
          <Route path="/doctors/new" component={DoctorNew} />
          <Route path="/doctors/:id/edit" component={DoctorEdit} />
          <Route path="/doctors/:id" component={DoctorProfile} />
          <Route path="/products" component={Products} />
          <Route path="/visits" component={Visits} />
          <Route path="/visits/new" component={VisitNew} />
          <Route path="/smart-route" component={SmartRoute} />
          <Route path="/pharmacy-insights" component={PharmacyInsights} />
          <Route path="/handover" component={Handover} />
          <Route path="/my-region" component={MyRegion} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
