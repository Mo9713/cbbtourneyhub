import { Leaderboard } from '../../../widgets/leaderboard'

interface Props {
  onSnoop: (targetId: string) => void
}

export default function LeaderboardPage({ onSnoop }: Props) {
  return <Leaderboard onSnoop={onSnoop} />
}