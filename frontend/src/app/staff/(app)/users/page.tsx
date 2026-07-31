"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserCog } from "lucide-react";
import { RequireStaff } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateOperatorDialog } from "@/components/users/create-operator-dialog";
import { getApiErrorMessage } from "@/lib/api-client";
import { usersApi } from "@/lib/api/users";
import type { StaffUser } from "@/lib/types";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Bosh administrator",
  OPERATOR: "Operator",
};

export default function UsersPage() {
  return (
    <RequireStaff roles={["SUPER_ADMIN"]}>
      <UsersPageContent />
    </RequireStaff>
  );
}

function UsersPageContent() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function loadUsers() {
    usersApi
      .list()
      .then(setUsers)
      .finally(() => setIsLoading(false));
  }

  useEffect(loadUsers, []);

  async function handleToggleActive(user: StaffUser) {
    setTogglingId(user.id);
    try {
      const updated = user.isActive
        ? await usersApi.deactivate(user.id)
        : await usersApi.activate(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Operatorlar</h1>
        <CreateOperatorDialog onCreated={loadUsers} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {users.map((user) => (
            <li key={user.id}>
              <Card>
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    {user.role === "SUPER_ADMIN" ? (
                      <ShieldCheck className="size-5" />
                    ) : (
                      <UserCog className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground">{user.phone}</p>
                  </div>
                  <Badge variant="secondary">{roleLabels[user.role] ?? user.role}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={user.isActive ? "text-destructive hover:text-destructive" : ""}
                    onClick={() => handleToggleActive(user)}
                    disabled={togglingId === user.id}
                  >
                    {togglingId === user.id && <Loader2 className="animate-spin" />}
                    {user.isActive ? "Faolsizlantirish" : "Faollashtirish"}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
