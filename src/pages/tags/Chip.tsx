import type { ReactNode } from 'react';
import { cx } from '../../components/ui';
const TONES = { good: 'bg-[#E6F4EC] text-[#00704A]', warn: 'bg-[#FFF3DC] text-[#8A5A00]', bad: 'bg-[#FDECEC] text-[#B3122A]', info: 'bg-sky text-navy', mute: 'bg-[#DDE3EA] text-ink' };
export const Chip = ({ tone = 'info', children }: { tone?: keyof typeof TONES; children: ReactNode }) => <span className={cx('inline-flex items-center rounded-md px-2 py-[1px] text-[12px] font-semibold leading-5', TONES[tone])}>{children}</span>;
export const consentTone = (c: string) => (c === 'essential' ? 'good' : c === 'analytics' ? 'info' : 'warn') as 'good' | 'info' | 'warn';
