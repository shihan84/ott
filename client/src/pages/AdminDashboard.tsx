import { Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import UserManagement from "@/components/UserManagement";
import AccessControl from "@/components/AccessControl";
import ServerManagement from "@/components/ServerManagement";

export default function AdminDashboard() {
  const { logout } = useUser();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <Layout className="w-6 h-6" />
            <h1 className="text-xl font-semibold">Stream Management</h1>
          </div>
          <Button variant="ghost" onClick={() => logout()}>
            Logout
          </Button>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <UserManagement />
          <AccessControl />
        </div>

        <ServerManagement />
      </main>
    </div>
  );
}
