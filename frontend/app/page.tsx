"use client";

import dynamic from "next/dynamic";

const TripPlanner = dynamic(() => import("./components/TripPlanner"), {
  ssr: false,
});

export default function Home() {
  return <TripPlanner />;
}
