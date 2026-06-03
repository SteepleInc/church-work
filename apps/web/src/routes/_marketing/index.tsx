import refs from "@church-task/backend/confect/_generated/refs";
import { COMPLETED_APP_LANDING_PATH } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryResult, useQuery } from "@confect/react";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/")({
  component: HomeComponent,
});

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

function HomeComponent() {
  const healthCheck = useQuery(refs.public.healthCheck.get);
  const isConnected = QueryResult.isSuccess(healthCheck) && healthCheck.value === "OK";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>API Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge variant={isConnected ? "secondary" : "outline"}>
              {QueryResult.isLoading(healthCheck)
                ? "Checking..."
                : isConnected
                  ? "Connected"
                  : "Error"}
            </Badge>
            <Link className={buttonVariants()} to={COMPLETED_APP_LANDING_PATH}>
              Enter App
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
