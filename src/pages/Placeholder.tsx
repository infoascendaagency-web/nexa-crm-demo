import { Empty, PageHeader } from '../components/ui';
export default function Placeholder({ title }: { title: string }) { return <div className="p-4 sm:p-6"><PageHeader title={title} /><Empty icon="gear" title="En construcción">Esta pantalla se construye en el siguiente paso.</Empty></div>; }
