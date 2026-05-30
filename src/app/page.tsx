import WizardForm from '../components/WizardForm';

export default function Home() {
  return (
    <main className="main-container">
      {/* Dynamic Background Effects */}
      <div className="bg-effect effect-1"></div>
      <div className="bg-effect effect-2"></div>
      
      <div className="header-container">
        <h1 className="title">
          Vehicle Bailment System
        </h1>
        <p className="subtitle">Secure Car Sharing Verification & Document Management</p>
      </div>

      <WizardForm />
    </main>
  );
}
