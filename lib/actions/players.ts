'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getPlayers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

export async function createPlayer(name: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('players')
    .insert({ name })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/staff/dashboard');
  return data;
}

/** Balance = sum(play) - sum(payment) - sum(win). Positive = player owes. */
export async function getPlayerBalance(playerId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('player_transactions')
    .select('transaction_type, amount')
    .eq('player_id', playerId);

  if (error) throw error;
  if (!data?.length) return 0;
  return data.reduce((sum, txn) => {
    const amt = txn.amount ?? 0;
    if (txn.transaction_type === 'play') return sum + amt;
    if (txn.transaction_type === 'payment' || txn.transaction_type === 'win') return sum - amt;
    return sum + amt; // legacy rows without type
  }, 0);
}

export async function getPlayerBalances(): Promise<Array<{ playerId: string; name: string; balance: number }>> {
  try {
    const supabase = await createClient();
    let players = [];
    try {
      players = await getPlayers();
    } catch (error) {
      console.error('Error getting players in getPlayerBalances:', error);
      return [];
    }
    
    const balances = await Promise.all(
      players.map(async (player) => {
        let balance = 0;
        try {
          balance = await getPlayerBalance(player.id);
        } catch (error) {
          console.error(`Error getting balance for player ${player.id}:`, error);
        }
        return {
          playerId: player.id,
          name: player.name,
          balance,
        };
      })
    );

    return balances;
  } catch (error) {
    console.error('Error in getPlayerBalances:', error);
    return [];
  }
}

export type PlayerTransactionType = 'play' | 'payment' | 'win';

export async function createPlayerTransaction(
  playerId: string,
  transactionType: PlayerTransactionType,
  amount: number,
  date: string,
  options?: { note?: string; gameDetails?: string }
) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('player_transactions')
    .insert({
      player_id: playerId,
      transaction_type: transactionType,
      amount: Math.abs(amount),
      game_details: options?.gameDetails ?? null,
      note: options?.note ?? null,
      date,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/staff/dashboard');
  revalidatePath('/admin/dashboard');
  return data;
}

export async function getPlayerTransactions(playerId: string, limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('player_transactions')
    .select('id, transaction_type, amount, game_details, note, date, created_at')
    .eq('player_id', playerId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export interface PlayerDailyActivity {
  playerId: string;
  name: string;
  playedBalance: number; // Total from 'play' transactions
  winBalance: number; // Total from 'win' transactions
  paidBalance: number; // Total from 'payment' transactions
  totalBalanceDue: number; // Current balance (played - paid - win)
}

export async function getPlayerDailyActivities(date: string): Promise<PlayerDailyActivity[]> {
  try {
    const supabase = await createClient();
    
    // Get all players
    let players = [];
    try {
      players = await getPlayers();
    } catch (error) {
      console.error('Error getting players in getPlayerDailyActivities:', error);
      return [];
    }
    
    // Get all transactions for the date
    const { data: transactions, error } = await supabase
      .from('player_transactions')
      .select('player_id, transaction_type, amount')
      .eq('date', date);

    if (error) {
      console.error('Error getting player transactions in getPlayerDailyActivities:', error);
      return [];
    }

    // Calculate daily activity for each player
    const activities: PlayerDailyActivity[] = await Promise.all(
      players.map(async (player) => {
        const playerTransactions = transactions?.filter(t => t.player_id === player.id) || [];
        
        let playedBalance = 0;
        let winBalance = 0;
        let paidBalance = 0;

        playerTransactions.forEach((txn) => {
          const amt = txn.amount ?? 0;
          if (txn.transaction_type === 'play') {
            playedBalance += amt;
          } else if (txn.transaction_type === 'win') {
            winBalance += amt;
          } else if (txn.transaction_type === 'payment') {
            paidBalance += amt;
          }
        });

        // Get total balance (all-time) - handle errors gracefully
        let totalBalanceDue = 0;
        try {
          totalBalanceDue = await getPlayerBalance(player.id);
        } catch (error) {
          console.error(`Error getting balance for player ${player.id}:`, error);
        }

        return {
          playerId: player.id,
          name: player.name,
          playedBalance,
          winBalance,
          paidBalance,
          totalBalanceDue,
        };
      })
    );

    return activities;
  } catch (error) {
    console.error('Error in getPlayerDailyActivities:', error);
    return [];
  }
}
