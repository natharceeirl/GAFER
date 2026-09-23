import logo from '../../assets/gafer-logo.png';
import './logo-gafer.css';

interface LogoGaferProps {
  ancho: number;
}

/** Logo oficial de gafer.pe. En modo oscuro va sobre una placa clara, porque el wordmark verde bosque no se lee sobre fondo oscuro. */
export function LogoGafer({ ancho }: LogoGaferProps) {
  return (
    <span className="logo-gafer">
      <img src={logo} alt="Gafer Saneamiento Ambiental" width={ancho} height={Math.round(ancho * 0.5875)} />
    </span>
  );
}
