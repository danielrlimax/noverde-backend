import { supabaseAdmin } from '../config/supabase';
import { CreateSimulationDTO, Simulation } from '../types';
import { logger } from '../utils/logger';
import { generateSecureId } from '../utils/crypto';

interface SimulationResult {
  id: string;
  monthly_bill: number;
  roof_area: number;
  region: string;
  irradiation: number;
  monthly_consumption: number;
  system_power: number;
  panels_needed: number;
  actual_panels: number;
  actual_power: number;
  monthly_generation: number;
  monthly_savings: number;
  annual_savings: number;
  savings_percentage: number;
  system_cost: number;
  payback_years: number;
  co2_avoided: number;
  trees_equivalent: number;
  savings_25_years: number;
}

class SimulationService {
  // Mapa de irradiação solar por região (kWh/m²/dia)
  private irradiationMap: Record<string, number> = {
    norte: 5.5,
    nordeste: 5.8,
    'centro-oeste': 5.4,
    sudeste: 5.0,
    sul: 4.5,
  };

  // Constantes do cálculo
  private readonly ENERGY_PRICE = 0.85; // R$/kWh médio
  private readonly SYSTEM_EFFICIENCY = 0.8; // 80% de eficiência
  private readonly PANEL_POWER = 0.55; // kWp por painel
  private readonly AREA_PER_PANEL = 2; // m² por painel
  private readonly COST_PER_KWP = 4500; // R$/kWp
  private readonly CO2_PER_KWH = 0.0817 / 1000; // ton CO2/kWh
  private readonly TREES_PER_TON_CO2 = 16.6; // árvores equivalentes

  /**
   * Calcula uma simulação de economia solar
   */
  calculate(data: CreateSimulationDTO): SimulationResult {
    const irradiation = this.irradiationMap[data.region] || 5.0;
    
    // Consumo mensal estimado
    const monthlyConsumption = data.monthly_bill / this.ENERGY_PRICE;
    
    // Potência do sistema necessária
    const systemPower = monthlyConsumption / (irradiation * 30 * this.SYSTEM_EFFICIENCY);
    
    // Painéis necessários
    const panelsNeeded = Math.ceil(systemPower / this.PANEL_POWER);
    
    // Painéis que cabem no telhado
    const maxPanels = Math.floor(data.roof_area / this.AREA_PER_PANEL);
    const actualPanels = Math.min(panelsNeeded, maxPanels);
    
    // Potência real do sistema
    const actualPower = actualPanels * this.PANEL_POWER;
    
    // Geração mensal
    const monthlyGeneration = actualPower * irradiation * 30 * this.SYSTEM_EFFICIENCY;
    
    // Economia mensal (máximo 95% da conta)
    const monthlySavings = Math.min(monthlyGeneration * this.ENERGY_PRICE, data.monthly_bill * 0.95);
    
    // Economia anual
    const annualSavings = monthlySavings * 12;
    
    // Porcentagem de economia
    const savingsPercentage = (monthlySavings / data.monthly_bill) * 100;
    
    // Custo do sistema
    const systemCost = actualPower * this.COST_PER_KWP;
    
    // Payback
    const paybackYears = systemCost / annualSavings;
    
    // Impacto ambiental (anual)
    const co2Avoided = monthlyGeneration * 12 * this.CO2_PER_KWH;
    const treesEquivalent = Math.round(co2Avoided * this.TREES_PER_TON_CO2);
    
    // Economia em 25 anos
    const savings25Years = annualSavings * 25 - systemCost;

    return {
      id: generateSecureId(),
      monthly_bill: data.monthly_bill,
      roof_area: data.roof_area,
      region: data.region,
      irradiation,
      monthly_consumption: Math.round(monthlyConsumption),
      system_power: actualPower,
      panels_needed: actualPanels,
      actual_panels: actualPanels,
      actual_power: actualPower,
      monthly_generation: Math.round(monthlyGeneration),
      monthly_savings: Math.round(monthlySavings),
      annual_savings: Math.round(annualSavings),
      savings_percentage: Math.min(savingsPercentage, 95),
      system_cost: Math.round(systemCost),
      payback_years: parseFloat(paybackYears.toFixed(1)),
      co2_avoided: parseFloat(co2Avoided.toFixed(2)),
      trees_equivalent: treesEquivalent,
      savings_25_years: Math.round(savings25Years),
    };
  }

  /**
   * Salva uma simulação no banco de dados
   */
  async save(
    result: SimulationResult,
    sessionId?: string,
    leadId?: string,
    ipAddress?: string
  ): Promise<Simulation | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('simulations')
        .insert({
          id: result.id,
          session_id: sessionId || generateSecureId(),
          lead_id: leadId,
          monthly_bill: result.monthly_bill,
          roof_area: result.roof_area,
          region: result.region,
          irradiation: result.irradiation,
          system_power: result.system_power,
          panels_needed: result.panels_needed,
          monthly_savings: result.monthly_savings,
          annual_savings: result.annual_savings,
          system_cost: result.system_cost,
          payback_years: result.payback_years,
          co2_avoided: result.co2_avoided,
          trees_equivalent: result.trees_equivalent,
          savings_25_years: result.savings_25_years,
          ip_address: ipAddress,
        })
        .select()
        .single();

      if (error) {
        logger.error('Erro ao salvar simulação:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Erro ao salvar simulação:', error);
      return null;
    }
  }

  /**
   * Busca simulações por lead
   */
  async findByLeadId(leadId: string): Promise<Simulation[]> {
    const { data, error } = await supabaseAdmin
      .from('simulations')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar simulações:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Estatísticas de simulações
   */
  async getStats(): Promise<{
    total: number;
    avgSavings: number;
    avgPayback: number;
    totalCo2Avoided: number;
  }> {
    const { data, error } = await supabaseAdmin
      .from('simulations')
      .select('monthly_savings, payback_years, co2_avoided');

    if (error || !data || data.length === 0) {
      return { total: 0, avgSavings: 0, avgPayback: 0, totalCo2Avoided: 0 };
    }

    const total = data.length;
    const avgSavings = data.reduce((sum, s) => sum + s.monthly_savings, 0) / total;
    const avgPayback = data.reduce((sum, s) => sum + s.payback_years, 0) / total;
    const totalCo2Avoided = data.reduce((sum, s) => sum + s.co2_avoided, 0);

    return {
      total,
      avgSavings: Math.round(avgSavings),
      avgPayback: parseFloat(avgPayback.toFixed(1)),
      totalCo2Avoided: parseFloat(totalCo2Avoided.toFixed(2)),
    };
  }
}

export const simulationService = new SimulationService();
