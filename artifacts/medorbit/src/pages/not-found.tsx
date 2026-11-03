import { Compass } from "lucide-react";
import { EmptyState, LinkBtn } from "@/components/ui-kit";

export default function NotFound() {
  return <div className="pt-10"><EmptyState icon={<Compass className="h-5 w-5" />} title="الصفحة غير موجودة" body="ربما تغيّر الرابط أو كُتب بشكل غير صحيح." action={<LinkBtn href="/" testId="link-go-home">العودة إلى اللوحة</LinkBtn>} /></div>;
}
