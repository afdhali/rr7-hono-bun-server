import React from "react";
import type { Route } from "./+types/home";
import { useLoaderData, type LoaderFunctionArgs } from "react-router";

export async function loader({ context }: Route.LoaderArgs) {
  const { serverInfo } = context;
  return serverInfo;
}

function About() {
  const serverInfo = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Server Info</h1>
      <p>Version: {serverInfo.version}</p>
      <p>Environment: {serverInfo.environment}</p>
      <p>Timestamp: {serverInfo.timestamp}</p>
    </div>
  );
}

export default About;
