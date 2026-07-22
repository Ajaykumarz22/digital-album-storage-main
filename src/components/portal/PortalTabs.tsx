import { type ReactNode } from "react";
import Tabs from "@/components/Tabs";

export default function PortalTabs({
  upload,
  deep,
  regular,
}: {
  upload: ReactNode;
  deep: ReactNode;
  regular: ReactNode;
}) {
  return (
    <Tabs
      tabs={[
        { key: "upload", label: "My Uploads", content: upload },
        { key: "deep", label: "Cold Drive", content: deep },
        { key: "regular", label: "Hot Drive", content: regular },
      ]}
    />
  );
}
