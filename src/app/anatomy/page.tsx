import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { HumanAtlasApp } from "@/components/sites/human-atlas-co-f41dd540/root-8a5edab2/HumanAtlasApp";

export const metadata: Metadata = {
  title: "ადამიანის ატლასი 3D — ბიოლოგია",
  description:
    "ინტერაქტიული 3D ანატომიის ატლასი: 2 239 სტრუქტურა, გულის მუშაობის, სუნთქვისა და სისხლის მიმოქცევის ანიმაციები, ქვიზი და ბარათები.",
};

export default async function AnatomyPage() {
  await requireUser("/anatomy");
  return <HumanAtlasApp />;
}
