import { cancelMeetingAction } from "@/app/actions";
import { EmptyState } from "@/app/components/dashboard/EmptyState";
import { SubmitButton } from "@/app/components/SubmitButton";
import { auth } from "@/app/lib/auth";
import { nylas } from "@/app/lib/nylas";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import prisma from "@/lib/prisma";
import { format, fromUnixTime } from "date-fns";
import { Video } from "lucide-react";
import React from "react";

// Tipos más flexibles que cubren todas las variantes de Nylas
interface When {
  start_time?: number;
  end_time?: number;
  start?: number;
  end?: number;
  time?: number;
  times?: Array<{ start_time: number; end_time: number }>;
  date?: string;
  dates?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Para propiedades adicionales
}

interface Conferencing {
  details?: {
    url?: string;
  };
  url?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Para propiedades adicionales
}

interface NylasEvent {
  id: string;
  when: When;
  title: string;
  participants: Array<{ name: string }>;
  conferencing?: Conferencing;
}

// Función para extraer el tiempo de inicio seguro
const getStartTime = (when: When): number | null => {
  return when.start_time ?? when.start ?? when.time ?? when.times?.[0]?.start_time ?? null;
};

// Función para extraer el tiempo de fin seguro
const getEndTime = (when: When): number | null => {
  return when.end_time ?? when.end ?? when.times?.[0]?.end_time ?? null;
};

// Función para extraer la URL de conferencia segura
const getMeetingUrl = (conferencing?: Conferencing): string | null => {
  return conferencing?.details?.url ?? conferencing?.url ?? null;
};

async function getData(userId: string): Promise<NylasEvent[]> {
  const userData = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      grantId: true,
      grantEmail: true,
    },
  });

  if (!userData) {
    throw new Error("User not found");
  }
  if (!userData.grantId) {
    throw new Error("User grantId not found");
  }
  if (!userData.grantEmail) {
    throw new Error("User grantEmail not found");
  }

  const response = await nylas.events.list({
    identifier: userData.grantId,
    queryParams: {
      calendarId: userData.grantEmail,
    },
  });

  return response.data.map((event) => ({
    ...event,
    title: event.title ?? "",
    participants: event.participants?.map((p: { name?: string }) => ({
      name: p.name ?? "",
    })) ?? [],
  }));
}

const MeetingsPage = async () => {
  const session = await auth();
  const data = await getData(session?.user?.id as string);

  return (
    <>
      {data.length === 0 ? (
        <EmptyState
          title="No meetings found"
          description="You don't have any meetings yet."
          buttonText="Create a new event type"
          href="/dashboard/new"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Bookings</CardTitle>
            <CardDescription>
              See upcoming and past events booked through your event type links.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.map((item) => {
              const startTime = getStartTime(item.when);
              const endTime = getEndTime(item.when);
              const meetingUrl = getMeetingUrl(item.conferencing);

              if (!startTime || !endTime) return null;

              return (
                <form key={item.id} action={cancelMeetingAction}>
                  <input type="hidden" name="eventId" value={item.id} />
                  <div className="grid grid-cols-3 justify-between items-center">
                    <div>
                      <p className="text-muted-foreground text-sm">
                        {format(fromUnixTime(startTime), "EEE, dd MMM")}
                      </p>
                      <p className="text-muted-foreground text-xs pt-1">
                        {format(fromUnixTime(startTime), "hh:mm a")} -{" "}
                        {format(fromUnixTime(endTime), "hh:mm a")}
                      </p>
                      {meetingUrl && (
                        <div className="flex items-center mt-1">
                          <Video className="size-4 mr-2 text-primary" />
                          <a
                            className="text-xs text-primary underline underline-offset-4"
                            target="_blank"
                            href={meetingUrl}
                            rel="noopener noreferrer"
                          >
                            Join Meeting
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <h2 className="text-sm font-medium">{item.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        You and {item.participants[0]?.name || 'participant'}
                      </p>
                    </div>
                    <SubmitButton
                      text="Cancel Event"
                      variant="destructive"
                      className="w-fit flex ml-auto"
                    />
                  </div>
                  <Separator className="my-3" />
                </form>
              );
            })}
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default MeetingsPage;